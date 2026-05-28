import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/Dialog';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { FileSignature, ShieldCheck } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any;
  onSign: (id: string, signature: string) => void;
}

export function ESignatureDialog({ open, onOpenChange, contract, onSign }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');

  if (!contract) return null;

  const handleSign = (e: React.FormEvent) => {
    e.preventDefault();
    if (agreed && signature.trim()) {
      onSign(contract.id, signature.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <FileSignature className="w-5 h-5 text-brand" /> 
             Review & Sign: {contract.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-surface-2 border-y border-border my-4 rounded text-sm leading-relaxed whitespace-pre-wrap font-serif">
          {contract.content || 'No contract content generated.'}
        </div>

        <form onSubmit={handleSign} className="space-y-6 pt-2">
          <div className="flex items-start gap-3 bg-brand-soft p-4 rounded-md border border-brand/20">
             <input 
               type="checkbox" 
               id="agree" 
               className="mt-1 w-4 h-4 text-brand rounded border-brand/30 focus:ring-brand"
               checked={agreed}
               onChange={(e) => setAgreed(e.target.checked)}
             />
             <Label htmlFor="agree" className="font-medium text-brand-strong cursor-pointer leading-tight">
               I have read and agree to the terms and conditions outlined in the agreement above. I understand this constitutes a legally binding digital signature.
             </Label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
             <div>
                <Label htmlFor="sigName">Type Full Legal Name</Label>
                <Input 
                  id="sigName" 
                  value={signature} 
                  onChange={(e) => setSignature(e.target.value)} 
                  placeholder={contract.recipientName}
                  className="mt-1.5 font-display text-lg"
                  autoComplete="off"
                />
             </div>
             <div>
                <Label>Date & Time</Label>
                <div className="mt-1.5 h-10 px-3 flex items-center bg-surface-2 border border-border rounded-md text-fg-muted font-mono text-xs">
                   {new Date().toLocaleString()} (System Logged)
                </div>
             </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!agreed || !signature.trim()}>
              <ShieldCheck className="w-4 h-4 mr-1" />
              Sign & Execute
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
