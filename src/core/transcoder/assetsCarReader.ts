/**
 * Pure TypeScript Apple CoreUI Asset Catalog (Assets.car / BOMStore) Inspector.
 * Parses the Apple Bill-of-Materials (BOMStore) binary header, block pointer table,
 * and named CoreUI variables (CARHEADER, RENDITIONS, FACETKEYS, KEYFORMAT, etc.)
 * without requiring macOS /usr/bin/assetutil.
 */

export interface BomVariableEntry {
  name: string;
  blockIndex: number;
  offset: number;
  length: number;
}

export interface AssetsCarInspection {
  valid: boolean;
  bomVersion: number;
  numberOfBlocks: number;
  variables: BomVariableEntry[];
  hasRenditions: boolean;
  hasFacetKeys: boolean;
  renditionsCountEstimate: number;
  limitations: string[];
}

const BOM_MAGIC = 'BOMStore';

export function inspectAssetsCar(bytes: Uint8Array): AssetsCarInspection {
  const empty: AssetsCarInspection = {
    valid: false,
    bomVersion: 0,
    numberOfBlocks: 0,
    variables: [],
    hasRenditions: false,
    hasFacetKeys: false,
    renditionsCountEstimate: 0,
    limitations: [],
  };

  if (bytes.byteLength < 512) {
    empty.limitations.push('Arquivo muito pequeno para cabeçalho BOMStore (Assets.car).');
    return empty;
  }

  let magic = '';
  for (let i = 0; i < 8; i++) magic += String.fromCharCode(bytes[i]);
  if (magic !== BOM_MAGIC) {
    empty.limitations.push(`Magic inválido ("${magic}", esperado "BOMStore").`);
    return empty;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bomVersion = view.getUint32(8, false);
  const numberOfBlocks = view.getUint32(12, false);
  const indexOffset = view.getUint32(16, false);
  const indexLength = view.getUint32(20, false);
  const varsOffset = view.getUint32(24, false);
  const varsLength = view.getUint32(28, false);

  const limitations: string[] = [];
  if (indexOffset + 4 > bytes.byteLength || indexOffset + indexLength > bytes.byteLength) {
    limitations.push('Tabela de blocos BOMStore fora dos limites do arquivo.');
    return { ...empty, valid: true, bomVersion, numberOfBlocks, limitations };
  }

  const pointerCount = view.getUint32(indexOffset, false);
  const blocks: { address: number; length: number }[] = [];
  const maxPointers = Math.min(pointerCount, 65536);
  for (let i = 0; i < maxPointers; i++) {
    const pOff = indexOffset + 4 + i * 8;
    if (pOff + 8 > bytes.byteLength) break;
    blocks.push({
      address: view.getUint32(pOff, false),
      length: view.getUint32(pOff + 4, false),
    });
  }

  const variables: BomVariableEntry[] = [];
  if (varsOffset + 4 <= bytes.byteLength && varsOffset + varsLength <= bytes.byteLength) {
    const varCount = view.getUint32(varsOffset, false);
    let cursor = varsOffset + 4;
    for (let i = 0; i < varCount && i < 256; i++) {
      if (cursor + 5 > bytes.byteLength) break;
      const blockIndex = view.getUint32(cursor, false);
      const nameLen = bytes[cursor + 4];
      cursor += 5;
      if (cursor + nameLen > bytes.byteLength) break;
      let name = '';
      for (let k = 0; k < nameLen; k++) name += String.fromCharCode(bytes[cursor + k]);
      cursor += nameLen;

      const blk = blocks[blockIndex] || { address: 0, length: 0 };
      variables.push({
        name,
        blockIndex,
        offset: blk.address,
        length: blk.length,
      });
    }
  } else {
    limitations.push('Tabela de variáveis BOMStore ausente ou truncada.');
  }

  const renditionsVar = variables.find((v) => v.name === 'RENDITIONS');
  const facetKeysVar = variables.find((v) => v.name === 'FACETKEYS');

  // If RENDITIONS points to a BOMTree header ('tree'), read entryCount at offset +16
  let renditionsCountEstimate = 0;
  if (renditionsVar && renditionsVar.offset + 20 <= bytes.byteLength) {
    const tOff = renditionsVar.offset;
    const tag = String.fromCharCode(bytes[tOff], bytes[tOff + 1], bytes[tOff + 2], bytes[tOff + 3]);
    if (tag === 'tree') {
      renditionsCountEstimate = view.getUint32(tOff + 16, false);
    }
  }

  return {
    valid: true,
    bomVersion,
    numberOfBlocks,
    variables,
    hasRenditions: Boolean(renditionsVar),
    hasFacetKeys: Boolean(facetKeysVar),
    renditionsCountEstimate,
    limitations,
  };
}
