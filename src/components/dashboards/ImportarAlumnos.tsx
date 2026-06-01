import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

interface CSVRow {
  legajo?: string;
  apellido?: string;
  nombres?: string;
  email?: string;
  anio_ingreso?: string;
  carrera_codigo?: string;
  [key: string]: any;
}

interface ParsedRow extends CSVRow {
  _isValid: boolean;
  _errors: string[];
}

export const ImportarAlumnos = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [carreras, setCarreras] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  
  // Stats
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Fetch carreras once to validate carrera_codigo
  React.useEffect(() => {
    const fetchCarreras = async () => {
      const { data } = await supabase.from('carreras').select('codigo');
      if (data) {
        setCarreras(data.map(c => c.codigo).filter(Boolean) as string[]);
      }
    };
    fetchCarreras();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setIsParsing(true);
    setImportResult(null);
    setImportError(null);

    Papa.parse<CSVRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        let vCount = 0;
        let eCount = 0;

        const processed = results.data.map(row => {
          const errors: string[] = [];
          
          if (!row.legajo?.trim()) errors.push("Falta legajo");
          if (!row.apellido?.trim()) errors.push("Falta apellido");
          if (!row.nombres?.trim()) errors.push("Falta nombres");
          
          if (!row.email?.trim()) {
            errors.push("Falta email");
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
            errors.push("Email inválido");
          }

          if (!row.anio_ingreso?.trim()) {
            errors.push("Falta año de ingreso");
          }

          if (!row.carrera_codigo?.trim()) {
            errors.push("Falta código carrera");
          } else if (carreras.length > 0 && !carreras.includes(row.carrera_codigo.trim())) {
            errors.push(`Carrera '${row.carrera_codigo}' no existe`);
          }

          const isValid = errors.length === 0;
          if (isValid) vCount++; else eCount++;

          return { ...row, _isValid: isValid, _errors: errors };
        });

        setParsedRows(processed);
        setValidCount(vCount);
        setErrorCount(eCount);
        setIsParsing(false);
      },
      error: (err) => {
        setImportError(`Error leyendo CSV: ${err.message}`);
        setIsParsing(false);
      }
    });
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r._isValid).map(r => {
      const cleanRow = { ...r };
      delete cleanRow._isValid;
      delete cleanRow._errors;
      return cleanRow;
    });

    if (validRows.length === 0) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const { data, error } = await supabase.functions.invoke('importar-alumnos', {
        body: { validRows }
      });

      if (error) {
        throw error;
      }

      setImportResult(data);
    } catch (err: any) {
      setImportError(err.message || 'Error desconocido al invocar la función de importación');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadLog = () => {
    if (!importResult) return;
    
    // Create a CSV of the errors
    if (importResult.errores && importResult.errores.length > 0) {
       const logData = importResult.errores.map((e: any) => ({
         legajo: e.fila?.legajo || '',
         email: e.fila?.email || '',
         error: e.error
       }));
       const csv = Papa.unparse(logData);
       const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
       const link = document.createElement('a');
       const url = URL.createObjectURL(blob);
       link.setAttribute('href', url);
       link.setAttribute('download', 'importacion_errores.csv');
       link.style.visibility = 'hidden';
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Importar Alumnos</h1>
        <p className="text-gray-400 mt-1">Carga masiva desde archivo CSV.</p>
      </header>

      {/* Upload Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
         <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
            <Upload className="w-12 h-12 text-blue-500 mb-4" />
            <p className="text-white font-medium mb-2">Sube o arrastra tu archivo CSV aquí</p>
            <p className="text-sm text-gray-400 mb-4 text-center max-w-md">
               El CSV debe contener: legajo, apellido, nombres, email, anio_ingreso, carrera_codigo.
            </p>
            <label className="btn btn-primary cursor-pointer">
              Seleccionar Archivo
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
         </div>
      </div>

      {isParsing && (
        <div className="flex items-center justify-center py-8">
          <span className="loading loading-spinner text-blue-500 loading-lg"></span>
        </div>
      )}

      {/* Preview Section */}
      <AnimatePresence>
        {parsedRows.length > 0 && !importResult && !isImporting && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Vista Previa ({parsedRows.length} filas totales)
                  </h2>
                  <div className="flex gap-4 mt-2">
                     <span className="text-teal-400 flex items-center gap-1 text-sm"><CheckCircle className="w-4 h-4"/> {validCount} Válidas</span>
                     <span className="text-red-400 flex items-center gap-1 text-sm"><XCircle className="w-4 h-4"/> {errorCount} Con Errores</span>
                  </div>
               </div>
               
               <button 
                  onClick={handleImport}
                  disabled={validCount === 0 || isImporting}
                  className="btn btn-primary"
               >
                  {isImporting ? <span className="loading loading-spinner"></span> : 'Confirmar Importación'}
               </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="text-gray-400 bg-gray-800/50">
                  <tr>
                    <th>Estado</th>
                    <th>Legajo</th>
                    <th>Apellido y Nombres</th>
                    <th>Email</th>
                    <th>Carrera</th>
                    <th>Año Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((row, i) => (
                    <tr key={i} className={`border-gray-800 ${row._isValid ? '' : 'bg-red-900/10'}`}>
                      <td>
                        {row._isValid ? (
                          <span className="badge badge-success gap-1 badge-sm"><CheckCircle className="w-3 h-3"/> OK</span>
                        ) : (
                          <div className="tooltip tooltip-right" data-tip={row._errors.join(', ')}>
                             <span className="badge badge-error gap-1 badge-sm cursor-help"><AlertCircle className="w-3 h-3"/> Error</span>
                          </div>
                        )}
                      </td>
                      <td className="text-gray-300">{row.legajo || '-'}</td>
                      <td className="text-gray-300">{row.apellido}, {row.nombres}</td>
                      <td className="text-gray-300">{row.email || '-'}</td>
                      <td className="text-gray-300">{row.carrera_codigo || '-'}</td>
                      <td className="text-gray-300">{row.anio_ingreso || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 && (
                <div className="p-4 text-center text-sm text-gray-500 bg-gray-800/20">
                  Mostrando las primeras 10 filas de {parsedRows.length}.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Importing Spinner */}
      {isImporting && (
         <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 shadow-xl flex flex-col items-center justify-center">
            <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Importando Alumnos...</h3>
            <p className="text-gray-400 text-center max-w-md">
               Esto puede tardar unos momentos dependiendo de la cantidad de registros y la velocidad de Supabase Auth.
            </p>
         </div>
      )}

      {/* Error total (Edge Function error) */}
      {importError && !isImporting && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 shadow-xl flex items-start gap-4">
           <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
           <div>
              <h3 className="text-lg font-bold text-red-400">Error durante la importación</h3>
              <p className="text-red-300/80 mt-1">{importError}</p>
              <button onClick={handleImport} className="btn btn-sm btn-outline mt-4 border-red-500 text-red-500 hover:bg-red-500 hover:border-red-500">
                Reintentar Válidas
              </button>
           </div>
        </div>
      )}

      {/* Success / Result Log */}
      {importResult && !isImporting && (
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-gray-900 border border-green-500/30 rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="p-6 border-b border-gray-800 bg-green-900/10">
             <h2 className="text-xl font-bold text-teal-400 flex items-center gap-2">
               <CheckCircle className="w-6 h-6" />
               Importación Finalizada
             </h2>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="stat bg-gray-800/50 rounded-xl border border-gray-700 p-4">
               <div className="stat-title text-gray-400">Nuevos Creados</div>
               <div className="stat-value text-teal-400">{importResult.alumnosNuevos || 0}</div>
             </div>
             <div className="stat bg-gray-800/50 rounded-xl border border-gray-700 p-4">
               <div className="stat-title text-gray-400">Actualizados</div>
               <div className="stat-value text-blue-400">{importResult.alumnosActualizados || 0}</div>
             </div>
             <div className="stat bg-gray-800/50 rounded-xl border border-gray-700 p-4">
               <div className="stat-title text-gray-400">Omitidos x Error</div>
               <div className="stat-value text-red-400">{importResult.errores?.length || 0}</div>
             </div>
          </div>

          {importResult.errores && importResult.errores.length > 0 && (
            <div className="p-6 border-t border-gray-800">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-300">Detalle de errores en base de datos</h3>
                  <button onClick={downloadLog} className="btn btn-sm btn-outline gap-2 text-gray-300 border-gray-600">
                     <Download className="w-4 h-4" /> Bajar Log CSV
                  </button>
               </div>
               <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-4">
                 <ul className="space-y-2 text-sm text-gray-400">
                    {importResult.errores.map((err: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 border-b border-gray-800 pb-2">
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span><strong>{err.fila?.legajo || 'S/L'}</strong>: {err.error}</span>
                      </li>
                    ))}
                 </ul>
               </div>
            </div>
          )}
          
          <div className="p-6 border-t border-gray-800 bg-gray-800/20 text-right">
             <button onClick={() => { setImportResult(null); setParsedRows([]); setFile(null); }} className="btn btn-ghost hover:bg-gray-800">
                Importar Otro Archivo
             </button>
          </div>
        </motion.div>
      )}

    </motion.div>
  );
};
