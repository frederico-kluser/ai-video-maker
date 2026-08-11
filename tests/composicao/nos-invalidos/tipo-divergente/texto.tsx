// Caso negativo: nome do arquivo diz "texto", meta.tipo diz "cabecalho".
import type { NoComponent, NoComponentMeta } from "src/composicao/contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "cabecalho",
  schema: "Cabecalho.1",
  id: "no-tipo-divergente",
  descricao: "Caso negativo: tipo nao casa com o nome do arquivo",
};

const Componente: NoComponent = () => null;
export default Componente;
