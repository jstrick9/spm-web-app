const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sw.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("self.addEventListener('push', (event) => {", "self.addEventListener('push', (event: any) => {");
code = code.replace("self.addEventListener('notificationclick', (event) => {", "self.addEventListener('notificationclick', (event: any) => {");
code = code.replace("self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {", "self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: any[]) => {");

fs.writeFileSync(path, code);
