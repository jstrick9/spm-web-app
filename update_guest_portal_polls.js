const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/portal/PublicGuestPortal.tsx';
let code = fs.readFileSync(path, 'utf8');

const importReplacement = `
import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, sdk } from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Label } from '../../ui/Label';
import { Badge } from '../../ui/Badge';
import { Map as MapIcon, Home, Send, PieChart } from 'lucide-react';
`;

code = code.replace(
  "import { Map as MapIcon, Home, Send } from 'lucide-react';",
  "import { Map as MapIcon, Home, Send, PieChart } from 'lucide-react';\nimport { useMutation, useQueryClient } from '@tanstack/react-query';\nimport { Badge } from '../../ui/Badge';"
);

// We need to add polls to the portal state
code = code.replace(
  "const [layout, setLayout] = useState<any>(null);",
  "const [layout, setLayout] = useState<any>(null);\n  const [polls, setPolls] = useState<any[]>([]);"
);

code = code.replace(
  "setLayout(r.layout);",
  "setLayout(r.layout);\n         sdk.feedback.getPolls(eventId).then(res => setPolls(res.polls));"
);

// Add the polls UI loop inside the home tab
const pollsUI = `
               {polls.length > 0 && activeGuest && (
                  <div className="space-y-4 animate-in fade-in duration-700 delay-300">
                     <h3 className="font-display text-2xl text-center border-t border-[#e1d5c9] pt-8">Couple's Polls</h3>
                     {polls.filter((p: any) => p.status === 'active').map((poll: any) => (
                        <Card key={poll.id} className="border-[#e1d5c9] shadow-sm">
                           <CardContent className="p-6">
                              <h4 className="font-semibold text-lg mb-4">{poll.question}</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 {poll.options.map((opt: any) => (
                                    <Button 
                                      key={opt.id} 
                                      variant="outline" 
                                      className="justify-between border-[#e1d5c9] hover:bg-[#fdfbf7] text-[#2c3e2e] h-auto py-3 whitespace-normal text-left"
                                      onClick={async () => {
                                        await sdk.feedback.votePoll(eventId, poll.id, opt.id);
                                        const res = await sdk.feedback.getPolls(eventId);
                                        setPolls(res.polls);
                                      }}
                                    >
                                      <span>{opt.text}</span>
                                      <Badge variant="secondary" className="ml-2 bg-[#e1d5c9]/30">{opt.votes} votes</Badge>
                                    </Button>
                                 ))}
                              </div>
                           </CardContent>
                        </Card>
                     ))}
                  </div>
               )}
`;

code = code.replace(
  "{!activeGuest && (",
  pollsUI + "\n\n               {!activeGuest && ("
);

fs.writeFileSync(path, code);
