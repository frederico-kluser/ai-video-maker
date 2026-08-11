// Caso negativo: tipo valido, versao de schema errada.
import type { NoComponent, NoComponentMeta } from "src/composicao/contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "texto",
  schema: "Texto.2",
  id: "no-texto-schema-errado",
  descricao: "Caso negativo: schema divergente do tipo",
};

const Componente: NoComponent = () => null;
export default Componente;
