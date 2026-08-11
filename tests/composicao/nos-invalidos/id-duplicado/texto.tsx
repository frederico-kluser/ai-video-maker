// Caso negativo (par 1 de 2): mesmo id que lista.tsx do mesmo diretorio.
import type { NoComponent, NoComponentMeta } from "src/composicao/contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "texto",
  schema: "Texto.1",
  id: "no-colidido",
  descricao: "Caso negativo: id duplicado",
};

const Componente: NoComponent = () => null;
export default Componente;
