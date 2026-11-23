import React, { useState } from 'react';
import { SaveKeyValuePair } from '../types/migration';
import {
  generateAndroidSharedPrefsXml,
  generateIosPlistFromSaves,
  triggerBrowserDownload,
} from '../services/ipaArchiveService';
import { Download, Plus, Trash2, ArrowRightLeft } from 'lucide-react';

interface SaveDataMigratorProps {
  appName: string;
  androidPackageName: string;
  saves: SaveKeyValuePair[];
  onChangeSaves: (nextSaves: SaveKeyValuePair[]) => void;
}

export const SaveDataMigrator: React.FC<SaveDataMigratorProps> = ({
  appName,
  androidPackageName,
  saves,
  onChangeSaves,
}) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<SaveKeyValuePair['iosType']>('String');

  const mapIosToAndroidType = (iosType: SaveKeyValuePair['iosType']): SaveKeyValuePair['androidType'] => {
    if (iosType === 'Integer') return 'int';
    if (iosType === 'Boolean') return 'boolean';
    if (iosType === 'Float') return 'float';
    return 'string';
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    const entry: SaveKeyValuePair = {
      key: newKey.trim().replace(/\s+/g, '_'),
      iosType: newType,
      value: newValue.trim() || (newType === 'Boolean' ? 'true' : newType === 'Integer' ? '0' : 'valor'),
      androidType: mapIosToAndroidType(newType),
    };
    onChangeSaves([...saves, entry]);
    setNewKey('');
    setNewValue('');
  };

  const handleDeleteEntry = (keyToRemove: string) => {
    onChangeSaves(saves.filter((item) => item.key !== keyToRemove));
  };

  const handleUpdateValue = (key: string, val: string) => {
    onChangeSaves(saves.map((item) => (item.key === key ? { ...item, value: val } : item)));
  };

  const iosPlistText = generateIosPlistFromSaves(saves);
  const androidXmlText = generateAndroidSharedPrefsXml(saves);

  const handleDownloadSharedPrefs = () => {
    const blob = new Blob([androidXmlText], { type: 'application/xml;charset=utf-8' });
    triggerBrowserDownload(blob, `${androidPackageName}_preferences.xml`);
  };

  const handleDownloadJsonBackup = () => {
    const jsonObj: Record<string, string | number | boolean> = {};
    for (const s of saves) {
      if (s.androidType === 'int') jsonObj[s.key] = parseInt(s.value, 10) || 0;
      else if (s.androidType === 'float') jsonObj[s.key] = parseFloat(s.value) || 0;
      else if (s.androidType === 'boolean') jsonObj[s.key] = s.value.toLowerCase() === 'true';
      else jsonObj[s.key] = s.value;
    }
    const blob = new Blob([JSON.stringify(jsonObj, null, 2)], { type: 'application/json' });
    triggerBrowserDownload(blob, `${androidPackageName}_save_backup.json`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Migração de Save Data & Preferências ({appName})
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Converta arquivos <code className="font-mono text-xs">NSUserDefaults (.plist)</code> do iOS para <code className="font-mono text-xs">SharedPreferences (.xml)</code> do Android sem perder o progresso em jogos ou configurações.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadJsonBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar JSON</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadSharedPrefs}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar shared_prefs.xml</span>
          </button>
        </div>
      </div>

      {/* Editable Key-Value Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Chaves de Progresso e Configuração Mapeadas ({saves.length} registros)
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Destino: /data/data/{androidPackageName}/shared_prefs/
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/40">
                <th className="py-2.5 px-4 font-medium">Chave (Key)</th>
                <th className="py-2.5 px-4 font-medium">Tipo iOS (.plist)</th>
                <th className="py-2.5 px-4 font-medium">Tipo Android (.xml)</th>
                <th className="py-2.5 px-4 font-medium">Valor Atual (Editável)</th>
                <th className="py-2.5 px-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {saves.map((item) => (
                <tr key={item.key} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                    {item.key}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                    {item.iosType}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-blue-600 dark:text-blue-400">
                    &lt;{item.androidType}&gt;
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => handleUpdateValue(item.key, e.target.value)}
                      className="w-full max-w-[220px] px-2.5 py-1 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 tabular-nums"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(item.key)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      title="Remover chave"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add New Save Key Form */}
        <form
          onSubmit={handleAddEntry}
          className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3"
        >
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Nova chave (ex: unlocked_level_10)"
            className="flex-1 min-w-[180px] px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as SaveKeyValuePair['iosType'])}
            className="px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="String">String</option>
            <option value="Integer">Integer</option>
            <option value="Float">Float</option>
            <option value="Boolean">Boolean</option>
          </select>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Valor (ex: 9999)"
            className="w-40 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Chave</span>
          </button>
        </form>
      </div>

      {/* Side-by-Side Plist vs SharedPreferences XML Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Origem iOS: NSUserDefaults (PropertyList .plist)
            </span>
            <span className="text-xs font-mono text-slate-500">XML Plist v1.0</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950 overflow-x-auto leading-relaxed">
            {iosPlistText}
          </pre>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
              <span>Destino Android: SharedPreferences (.xml)</span>
            </span>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">Pronto para APK</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950 overflow-x-auto leading-relaxed">
            {androidXmlText}
          </pre>
        </div>
      </div>
    </div>
  );
};
