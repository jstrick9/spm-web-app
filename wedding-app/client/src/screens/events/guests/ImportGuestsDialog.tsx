import React, { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../ui/Dialog';
import { Button } from '../../../ui/Button';
import { parseCsv } from '../../../lib/csv';
import { guessMapping, GUEST_FIELDS, GuestField } from './csvMapping';
import { guestsSdk, GuestInput } from '../../../sdk/guests';
import { AlertTriangle, CheckCircle2, UploadCloud, ChevronRight, ChevronLeft, Download } from 'lucide-react';
import { Select } from '../../../ui/Select';
import { cn } from '../../../ui/lib/cn';

interface Props {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = 'upload' | 'map' | 'preview' | 'import';

interface ValidationResult {
  guest: GuestInput;
  errors: Record<string, string>;
  isValid: boolean;
  rowIdx: number;
  originalRow: string[];
}

export function ImportGuestsDialog({ eventId, open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  
  const [mapping, setMapping] = useState<Record<number, GuestField>>({});
  const [hasHeaders, setHasHeaders] = useState(true);
  
  const [collisionMode, setCollisionMode] = useState<'skip' | 'replace' | 'append'>('skip');
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{ 
    inserted: number; 
    updated: number; 
    skipped: number; 
    failures: { row: string[]; error: string }[];
  } | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length > 0) {
      setRows(parsed);
      
      const newMapping: Record<number, GuestField> = {};
      let savedMappings: Record<string, string> = {};
      try {
        savedMappings = JSON.parse(localStorage.getItem('wvi_csv_mappings') || '{}');
      } catch (e) {
        // ignore
      }

      parsed[0].forEach((col, idx) => {
        const colClean = col.trim().toLowerCase();
        if (savedMappings[colClean]) {
          newMapping[idx] = savedMappings[colClean] as GuestField;
        } else {
          const guess = guessMapping(col);
          if (guess.field && guess.confidence > 0.5) {
            newMapping[idx] = guess.field;
          }
        }
      });
      setMapping(newMapping);
    }
    setStep('map');
  };

  const parsedData = useMemo(() => {
    if (!rows.length) return [];
    const dataRows = hasHeaders ? rows.slice(1) : rows;
    
    return dataRows.map((row, idx): ValidationResult => {
      const guest: GuestInput = { fullName: '' };
      const errors: Record<string, string> = {};
      let hasData = false;

      Object.entries(mapping).forEach(([colIdx, field]) => {
        const val = row[parseInt(colIdx)];
        if (!val || !val.trim()) return;
        hasData = true;
        
        if (field === 'rsvpStatus') {
          const s = val.toLowerCase().trim();
          if (['pending', 'attending', 'declined', 'maybe'].includes(s)) {
            guest.rsvpStatus = s as any;
          } else {
            errors.rsvpStatus = 'Invalid RSVP status';
          }
        } else if (field === 'email') {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailPattern.test(val.trim())) {
            guest.email = val.trim();
          } else {
            errors.email = 'Invalid email format';
          }
        } else if (field === 'fullName') {
          guest.fullName = val.trim();
        } else {
          (guest as any)[field] = val.trim();
        }
      });
      
      if (hasData && !guest.fullName) {
        errors.fullName = 'Full Name is required';
      }
      
      return {
        guest,
        errors,
        isValid: Object.keys(errors).length === 0 && hasData,
        rowIdx: hasHeaders ? idx + 1 : idx,
        originalRow: row
      };
    }).filter(r => Object.keys(r.guest).length > 1 || r.guest.fullName || Object.keys(r.errors).length > 0);
  }, [rows, hasHeaders, mapping]);

  const handleImport = async () => {
    setStep('import');
    setImportStatus('importing');
    
    const validGuests = parsedData.filter(d => d.isValid).map(d => d.guest);
    const failures = parsedData.filter(d => !d.isValid).map(d => ({
      row: d.originalRow,
      error: Object.values(d.errors).join(', ') || 'Unknown error'
    }));
    
    if (validGuests.length === 0) {
      setImportStatus('done');
      setImportResult({ inserted: 0, updated: 0, skipped: 0, failures });
      return;
    }

    const batchSize = 100;
    let inserted = 0, updated = 0, skipped = 0;
    
    try {
      for (let i = 0; i < validGuests.length; i += batchSize) {
        const batch = validGuests.slice(i, i + batchSize);
        const res = await guestsSdk.bulkCreate(eventId, collisionMode, batch);
        inserted += res.inserted;
        updated += res.updated;
        skipped += res.skipped;
        
        setImportProgress(Math.round(((i + batch.length) / validGuests.length) * 100));
      }
      setImportStatus('done');
      setImportResult({ inserted, updated, skipped, failures });
    } catch (e: any) {
      setImportStatus('error');
      setImportResult({ inserted, updated, skipped, failures: [{ row: [], error: e.message || 'Server error' }] });
    }
  };
  
  const reset = () => {
    setStep('upload');
    setFile(null);
    setRows([]);
    setMapping({});
    setImportStatus('idle');
    setImportProgress(0);
    setImportResult(null);
  };
  
  const onDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (importStatus === 'done') onImported();
      setTimeout(reset, 200);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={onDialogChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Guests</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-4">
          {step === 'upload' && (
            <UploadStep onFile={handleFile} />
          )}
          
          {step === 'map' && (
            <MapStep 
              rows={rows} 
              hasHeaders={hasHeaders} 
              setHasHeaders={setHasHeaders}
              mapping={mapping} 
              setMapping={setMapping}
              onNext={() => setStep('preview')}
              onBack={() => setStep('upload')}
            />
          )}
          
          {step === 'preview' && (
            <PreviewStep
              parsedData={parsedData}
              collisionMode={collisionMode}
              setCollisionMode={setCollisionMode}
              onNext={handleImport}
              onBack={() => setStep('map')}
            />
          )}
          
          {step === 'import' && (
            <ImportStep 
              status={importStatus}
              progress={importProgress}
              result={importResult}
              originalHeaders={hasHeaders && rows.length > 0 ? rows[0] : []}
              onDone={() => onDialogChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFile(e.target.files[0]);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border rounded-lg bg-surface">
      <UploadCloud className="w-12 h-12 text-fg-muted mb-4" />
      <h3 className="text-lg font-medium mb-1">Upload CSV</h3>
      <p className="text-sm text-fg-muted mb-6 text-center max-w-sm">
        Upload a .csv or .tsv file containing your guest list. You'll be able to map columns in the next step.
      </p>
      <input 
        type="file" 
        accept=".csv,.tsv" 
        className="hidden" 
        ref={inputRef}
        onChange={handleChange}
        data-testid="csv-file-input"
      />
      <Button onClick={() => inputRef.current?.click()}>
        Select File
      </Button>
    </div>
  );
}

function MapStep({ rows, hasHeaders, setHasHeaders, mapping, setMapping, onNext, onBack }: any) {
  const headers = rows[0] || [];
  const sampleRow = rows[hasHeaders ? 1 : 0] || [];
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Map Columns</h3>
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={hasHeaders} 
            onChange={e => setHasHeaders(e.target.checked)} 
            className="rounded border-border"
          />
          First row contains headers
        </label>
      </div>
      
      <div className="flex-1 overflow-auto border rounded-lg divide-y bg-surface">
        <div className="grid grid-cols-3 bg-surface-2 p-3 font-medium text-sm border-b">
          <div>Column in File</div>
          <div>Sample Data</div>
          <div>Maps to Field</div>
        </div>
        {headers.map((col: string, idx: number) => (
          <div key={idx} className="grid grid-cols-3 p-3 items-center gap-4 text-sm">
            <div className="truncate font-medium">{hasHeaders ? col : `Column ${idx + 1}`}</div>
            <div className="truncate text-fg-muted">{sampleRow[idx] || '-'}</div>
            <div>
              <Select 
                value={mapping[idx] || ''}
                onValueChange={(val: string) => {
                  setMapping((prev: any) => {
                    const next = {
                      ...prev,
                      [idx]: val || undefined
                    };
                    if (hasHeaders && col) {
                      try {
                        const saved = JSON.parse(localStorage.getItem('wvi_csv_mappings') || '{}');
                        saved[col.trim().toLowerCase()] = val || undefined;
                        localStorage.setItem('wvi_csv_mappings', JSON.stringify(saved));
                      } catch (e) {
                        // ignore
                      }
                    }
                    return next;
                  });
                }}
                data-testid={`map-select-${idx}`}
              >
                <option value="">-- Ignore --</option>
                {GUEST_FIELDS.map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </Select>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={onNext} disabled={!Object.values(mapping).includes('fullName')}>
          Continue <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function PreviewStep({ parsedData, collisionMode, setCollisionMode, onNext, onBack }: any) {
  const numValid = parsedData.filter((r: any) => r.isValid).length;
  const numErrors = parsedData.length - numValid;
  
  return (
    <div className="flex flex-col h-[70vh]">
      <h3 className="text-lg font-medium mb-4">Preview & Resolve</h3>
      
      <div className="bg-surface p-4 rounded-lg border mb-6 flex-shrink-0">
        <h4 className="font-medium mb-2">Email Collision Strategy</h4>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input 
              type="radio" name="mode" value="skip" 
              checked={collisionMode === 'skip'} onChange={() => setCollisionMode('skip')}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm">Skip</div>
              <div className="text-xs text-fg-muted">Keep existing guest</div>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input 
              type="radio" name="mode" value="replace" 
              checked={collisionMode === 'replace'} onChange={() => setCollisionMode('replace')}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm">Replace</div>
              <div className="text-xs text-fg-muted">Update with new data</div>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input 
              type="radio" name="mode" value="append" 
              checked={collisionMode === 'append'} onChange={() => setCollisionMode('append')}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-sm">Append</div>
              <div className="text-xs text-fg-muted">Allow duplicates</div>
            </div>
          </label>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto border rounded-lg flex flex-col min-h-0">
        <div className="p-3 bg-surface-2 border-b font-medium text-sm flex justify-between sticky top-0">
          <span>Data Preview</span>
          <span className="text-fg-muted">
            {numValid} valid, {numErrors > 0 ? <span className="text-danger font-semibold">{numErrors} errors</span> : '0 errors'}
          </span>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-surface-2 text-fg-muted sticky top-0">
              <tr>
                <th className="px-4 py-2 font-medium">Row</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Party</th>
                <th className="px-4 py-2 font-medium">RSVP</th>
                <th className="px-4 py-2 font-medium">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {parsedData.slice(0, 50).map((r: any, i: number) => (
                <tr key={i} className={cn(!r.isValid && "bg-danger/10")}>
                  <td className="px-4 py-2 text-fg-muted">{r.rowIdx}</td>
                  <td className="px-4 py-2">{r.guest.fullName || '-'}</td>
                  <td className="px-4 py-2">{r.guest.email || '-'}</td>
                  <td className="px-4 py-2">{r.guest.partyName || '-'}</td>
                  <td className="px-4 py-2">{r.guest.rsvpStatus || '-'}</td>
                  <td className="px-4 py-2 text-danger text-xs">
                    {Object.values(r.errors).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsedData.length > 50 && (
            <div className="p-2 text-center text-xs text-fg-muted bg-surface-2">
              Showing first 50 rows of {parsedData.length}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between mt-6 flex-shrink-0">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={onNext} disabled={numValid === 0} data-testid="start-import">
          Import {numValid} Guests <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function ImportStep({ status, progress, result, originalHeaders, onDone }: any) {
  const downloadFailures = () => {
    if (!result?.failures?.length) return;
    
    // Create CSV content for failures
    const headers = [...originalHeaders, 'Error'];
    const rows = result.failures.map((f: any) => {
      const row = [...f.row, f.error];
      return row.map(cell => {
        const c = String(cell).replace(/"/g, '""');
        return /[,\n"]/.test(c) ? `"${c}"` : c;
      }).join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'import_failures.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {status === 'importing' && (
        <div className="w-full max-w-md">
          <h3 className="text-lg font-medium mb-4 text-center">Importing...</h3>
          <div className="w-full bg-surface-2 rounded-full h-2.5 mb-2 overflow-hidden">
            <div className="bg-brand h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="text-center text-sm text-fg-muted">{progress}% Complete</div>
        </div>
      )}
      
      {status === 'done' && (
        <div className="w-full max-w-md flex flex-col items-center text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Import Complete</h3>
          
          <div className="bg-surface border rounded-lg p-4 w-full text-left mb-6 flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-fg-muted">Added:</span>
              <span className="font-medium text-green-600">{result?.inserted || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Updated:</span>
              <span className="font-medium text-blue-600">{result?.updated || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Skipped:</span>
              <span className="font-medium text-gray-600">{result?.skipped || 0}</span>
            </div>
            <div className="flex justify-between border-t mt-2 pt-2">
              <span className="text-fg-muted">Failed:</span>
              <span className="font-medium text-danger">{result?.failures?.length || 0}</span>
            </div>
          </div>
          
          {result?.failures?.length > 0 && (
            <Button variant="outline" className="w-full mb-4" onClick={downloadFailures}>
              <Download className="w-4 h-4 mr-2" /> Download Failures CSV
            </Button>
          )}
          
          <Button onClick={onDone} className="w-full">
            View Guests
          </Button>
        </div>
      )}
      
      {status === 'error' && (
        <div className="w-full max-w-md flex flex-col items-center text-center">
          <AlertTriangle className="w-16 h-16 text-danger mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Import Failed</h3>
          <p className="text-fg-muted mb-6">There was an unexpected error while importing your guests.</p>
          <Button onClick={onDone} className="w-full">
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
