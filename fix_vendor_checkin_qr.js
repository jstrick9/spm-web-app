const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/checkin/VendorCheckInApp.tsx';
let code = fs.readFileSync(path, 'utf8');

const qrComponent = `
import { Html5QrcodeScanner } from 'html5-qrcode';

function QRScannerModal({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (data: string) => void }) {
  useEffect(() => {
    if (!open) return;
    
    // We delay slightly to let the modal mount
    let scanner: any = null;
    const timeout = setTimeout(() => {
      scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scanner.render(
        (decodedText: string) => {
          scanner.clear();
          onScan(decodedText);
        },
        (error: any) => {
          // ignore stream errors
        }
      );
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (scanner) {
        try { scanner.clear(); } catch {}
      }
    };
  }, [open, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm relative bg-white rounded-xl overflow-hidden">
        <div className="p-4 bg-surface flex justify-between items-center border-b border-border">
          <h3 className="font-semibold">Scan Vendor Pass</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <div id="reader" className="w-full bg-black min-h-[300px]" />
      </div>
      <p className="text-white/70 mt-6 text-sm">Align the QR code within the frame.</p>
    </div>
  );
}
`;

code = code.replace(
  "import { QrCode, Search, LogIn, LogOut, Clock, AlertCircle, Phone, Mail, Building2, UserCircle } from 'lucide-react';",
  "import { QrCode, Search, LogIn, LogOut, Clock, AlertCircle, Phone, Mail, Building2, UserCircle, X } from 'lucide-react';\n" + qrComponent
);

code = code.replace(
  "const [statusLog, setStatusLog] = useState<Record<string, CheckInStatus>>({});",
  "const [statusLog, setStatusLog] = useState<Record<string, CheckInStatus>>({});\n  const [scanning, setScanning] = useState(false);\n  const { toast } = useToast();"
);

code = code.replace(
  "import { sdk } from '../../sdk';",
  "import { sdk } from '../../sdk';\nimport { useToast } from '../../ui/Toast';"
);

// We need a handleScan function
const scanLogic = `
  const handleScan = (decodedText: string) => {
    setScanning(false);
    
    // We expect the QR code to just be the vendor ID for now
    const vendorId = decodedText;
    const vendor = vendors.find((v: any) => v.id === vendorId);
    
    if (vendor) {
       updateStatus(vendorId, 'arrived');
       toast({ title: \`\${vendor.name} Checked In!\`, variant: 'success' });
    } else {
       toast({ title: 'Unknown QR Code', description: 'Could not match this pass to any vendor.', variant: 'destructive' });
    }
  };
`;

code = code.replace(
  "const vendors = data?.vendors || [];",
  "const vendors = data?.vendors || [];\n" + scanLogic
);

// Bind the button
code = code.replace(
  "<Button variant=\"secondary\" className=\"h-12 px-6 rounded-xl shadow-sm shrink-0 border border-border\">",
  "<Button variant=\"secondary\" className=\"h-12 px-6 rounded-xl shadow-sm shrink-0 border border-border\" onClick={() => setScanning(true)}>"
);

// Add the component
code = code.replace(
  "</main>\n    </div>",
  `</main>\n      <QRScannerModal open={scanning} onClose={() => setScanning(false)} onScan={handleScan} />\n    </div>`
);

fs.writeFileSync(path, code);
