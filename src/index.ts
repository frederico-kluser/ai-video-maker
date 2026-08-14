// Entry default do Remotion — ponto de entrada quando o CLI roda SEM entry
// explicito (`npm run dev` / `just dev`: `npx remotion studio`).
//
// O registro real da raiz (`registerRoot(RaizRemotion)`, composicao id="manifesto")
// mora em `src/composicao/raiz.tsx`. Este arquivo importa a raiz estaticamente
// para que `registerRoot()` seja chamado no escopo de modulo — o contrato que o
// CLI exige do entry (remotion.dev/docs/register-root).
import "./composicao/raiz";
