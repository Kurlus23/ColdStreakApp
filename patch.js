const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "client/src/pages/Home.tsx");
let code = fs.readFileSync(file, "utf8");

code = code.replace(
  `for (const { name, svc, char } of candidates) {`,
  `const subOk = [], subFail = [], notifLog = [];
      for (const { name, svc, char } of candidates) {`
);

code = code.replace(
  `const bytes = Array.from(new Uint8Array(dv.buffer)).map(b => b.toString(16).padStart(2,"0")).join(" ");
          console.log(\`[BLE] \${name} notification: \${bytes}\`);`,
  `const bytes = Array.from(new Uint8Array(dv.buffer)).map(b => b.toString(16).padStart(2,"0")).join(" ");`
);

code = code.replace(
  `console.log(\`[BLE] \${name} parsed tempF=\${tempF}\`);
          if (tempF !== null) settle({ protocol: name, tempF });`,
  `if (!notifLog.find(l => l.startsWith(name))) {
            notifLog.push(\`\${name}: \${bytes.slice(0,23)} → \${tempF ?? "null"}°F\`);
            toast({ title: \`[BLE] \${name} data\`, description: \`\${bytes.slice(0,23)} → \${tempF ?? "null"}°F\`, duration: 8000 });
          }
          if (tempF !== null) settle({ protocol: name, tempF });`
);

code = code.replace(
  `console.log(\`[BLE] \${name} subscribed OK\`);`,
  `subOk.push(name);
          toast({ title: \`[BLE] \${name} subscribed ✓\`, duration: 4000 });`
);

code = code.replace(
  `console.log(\`[BLE] tp25 sending activation write\`);
            await BleClient.writeWithoutResponse(deviceId, TP25_SERVICE, TP25_CHAR_WRITE,
              new DataView(new Uint8Array([0x21, 0x03, 0x01, 0x25]).buffer)).catch((e) => console.log(\`[BLE] tp25 write error: \${e}\`));`,
  `await BleClient.writeWithoutResponse(deviceId, TP25_SERVICE, TP25_CHAR_WRITE,
              new DataView(new Uint8Array([0x21, 0x03, 0x01, 0x25]).buffer)).catch(() => {});`
);

code = code.replace(
  `}).catch((e) => console.log(\`[BLE] \${name} subscribe FAILED: \${e}\`)); // service not found`,
  `}).catch((e) => {
          subFail.push(name);
          toast({ title: \`[BLE] \${name} failed ✗\`, description: String(e).slice(0, 60), duration: 6000 });
        });`
);

fs.writeFileSync(file, code, "utf8");
console.log("Patch applied. Matches made — check Home.tsx looks correct.");
