// Controle POSITIVO da descoberta: modulo que casa o contrato.
// Se este diretorio falhasse, os casos negativos nao provariam nada.
import type { NoComponent, NoComponentMeta } from "src/composicao/contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "texto",
  schema: "Texto.1",
  id: "no-texto-de-teste",
  descricao: "Controle positivo da descoberta",
};

const Texto: NoComponent = () => null;
export default Texto;
