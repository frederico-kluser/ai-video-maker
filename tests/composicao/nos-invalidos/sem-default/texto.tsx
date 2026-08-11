// Caso negativo: exporta meta, NAO exporta default.
import type { NoComponentMeta } from "src/composicao/contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "texto",
  schema: "Texto.1",
  id: "no-texto-sem-default",
  descricao: "Caso negativo: sem export default",
};
