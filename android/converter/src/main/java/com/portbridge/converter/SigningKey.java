package com.portbridge.converter;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

/**
 * Chave de assinatura dos APKs gerados. Criada uma vez e reutilizada: o Android só
 * aceita atualizar um app se a assinatura for a mesma.
 * Arquivos: key.pk8 (PKCS#8) e cert.der (X.509 autoassinado, RSA 2048, SHA-256).
 */
public final class SigningKey {
    public final PrivateKey key;
    public final X509Certificate cert;

    private SigningKey(PrivateKey key, X509Certificate cert) {
        this.key = key;
        this.cert = cert;
    }

    public static SigningKey loadOrCreate(File dir, String commonName) throws IOException, GeneralSecurityException {
        File pk8 = new File(dir, "key.pk8"), der = new File(dir, "cert.der");
        if (pk8.exists() && der.exists()) {
            PrivateKey k = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(read(pk8)));
            X509Certificate c = (X509Certificate) CertificateFactory.getInstance("X.509")
                    .generateCertificate(new ByteArrayInputStream(read(der)));
            return new SigningKey(k, c);
        }
        dir.mkdirs();
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048, new SecureRandom());
        KeyPair kp = g.generateKeyPair();
        byte[] certDer = selfSigned(kp, commonName);
        write(pk8, kp.getPrivate().getEncoded());
        write(der, certDer);
        X509Certificate c = (X509Certificate) CertificateFactory.getInstance("X.509")
                .generateCertificate(new ByteArrayInputStream(certDer));
        return new SigningKey(kp.getPrivate(), c);
    }

    // ------------------------------------------------------------ DER mínimo
    private static final byte[] OID_SHA256_RSA = {0x2A, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xF7, 0x0D, 0x01, 0x01, 0x0B};
    private static final byte[] OID_CN = {0x55, 0x04, 0x03};

    static byte[] selfSigned(KeyPair kp, String cn) throws GeneralSecurityException, IOException {
        byte[] algId = seq(tlv(0x06, OID_SHA256_RSA), tlv(0x05, new byte[0]));
        byte[] name = seq(tlv(0x31, seq(tlv(0x06, OID_CN), tlv(0x0C, cn.getBytes(StandardCharsets.UTF_8)))));
        Date from = new Date(System.currentTimeMillis() - 86400000L);
        Date to = new Date(from.getTime() + 80L * 365 * 86400000L);
        byte[] validity = seq(time(from), time(to));
        byte[] serial = tlv(0x02, new BigInteger(63, new SecureRandom()).add(BigInteger.ONE).toByteArray());
        byte[] version = tlv(0xA0, tlv(0x02, new byte[] {2}));  // v3
        byte[] tbs = seq(version, serial, algId, name, validity, name, kp.getPublic().getEncoded());
        Signature s = Signature.getInstance("SHA256withRSA");
        s.initSign(kp.getPrivate());
        s.update(tbs);
        byte[] sig = s.sign();
        byte[] bits = new byte[sig.length + 1];
        System.arraycopy(sig, 0, bits, 1, sig.length);
        return seq(tbs, algId, tlv(0x03, bits));
    }

    private static byte[] time(Date d) throws IOException {
        SimpleDateFormat f = new SimpleDateFormat("yyyyMMddHHmmss'Z'");
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        String s = f.format(d);
        if (s.compareTo("2050") < 0) return tlv(0x17, s.substring(2).getBytes(StandardCharsets.US_ASCII));
        return tlv(0x18, s.getBytes(StandardCharsets.US_ASCII));
    }

    private static byte[] seq(byte[]... parts) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        for (byte[] p : parts) b.write(p);
        return tlv(0x30, b.toByteArray());
    }

    private static byte[] tlv(int tag, byte[] v) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        b.write(tag);
        int n = v.length;
        if (n < 0x80) b.write(n);
        else if (n < 0x100) { b.write(0x81); b.write(n); }
        else if (n < 0x10000) { b.write(0x82); b.write(n >> 8); b.write(n & 0xFF); }
        else { b.write(0x83); b.write(n >> 16); b.write((n >> 8) & 0xFF); b.write(n & 0xFF); }
        b.write(v);
        return b.toByteArray();
    }

    private static byte[] read(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            return Ipa.readAll(in);
        }
    }

    private static void write(File f, byte[] d) throws IOException {
        try (OutputStream o = new FileOutputStream(f)) {
            o.write(d);
        }
    }
}
