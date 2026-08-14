import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = "fixtures/cassetes/autoria/dfb7e0a33359d36408b9d5c76bd55f618dd15d6ed72179c444fb17e90d2ea709";
const nome = "f259a122596e9aa9188a225ad834ea83c7f6b4a5975fbb1336ae4932520a22e3";
const corpo = readFileSync(`${dir}/corpos/${nome}`);
const h = createHash("sha256").update(corpo).digest("hex");
console.log("hashCorpo confere:", h === nome);
console.log("h:", h);

// E o corpo antigo (deletado) tinha o hash do proprio nome?
import { execSync } from "node:child_process";
const velho = execSync(`git show main:${dir}/corpos/cc5fcf95f0d3502c1ead042bee1499007afee2a2437354f4b2a22a988fe637cb`);
const hv = createHash("sha256").update(velho).digest("hex");
console.log("hash do corpo ANTIGO:", hv);
