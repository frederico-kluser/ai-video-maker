// Caso negativo: tipo que nao existe no schema do manifesto.
import type { NoComponent, NoComponentMeta } from "src/composicao/contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "holograma",
  schema: "Holograma.1",
  id: "no-holograma",
  descricao: "Caso negativo: tipo fora do catalogo do schema",
};

const Componente: NoComponent = () => null;
export default Componente;
