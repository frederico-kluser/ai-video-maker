// Caso negativo (par 2 de 2): mesmo id que texto.tsx do mesmo diretorio.
import type { NoComponent, NoComponentMeta } from "src/composicao/contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "lista",
  schema: "Lista.1",
  id: "no-colidido",
  descricao: "Caso negativo: id duplicado",
};

const Componente: NoComponent = () => null;
export default Componente;
