/**
 * src/render/encode/fila.ts
 *
 * A FILA EXPLICITA DE SESSOES DE ENCODE (S-10 dos 12 singletons; teto do
 * I-03, ADR-0032 decisao 2, docs/medicao/maquina.md M3).
 *
 * A medicao da maquina: o NVENC da RTX 4070 (driver 580.159.03) inicializa
 * 8 sessoes simultaneas e, a partir de 10 em paralelo, sessoes FALHAM na
 * inicializacao; o libx264 satura a CPU entre 4 e 8 sessoes (718 fps em 4,
 * +2% em 8). O teto DECLARADO e a metade da margem:
 *
 *   4 sessoes NVENC + 4 sessoes libx264 simultaneas, com fila explicita.
 *
 * "Fila explicita" = lancar encodes alem do teto nunca acontece: o
 * `adquirir(motor)` BLOQUEIA (promise) ate uma sessao do motor liberar.
 * Os limites sao por motor — uma fila de NVENC cheia nao segura uma
 * sessao de libx264, e vice-versa (os dois tetos sao independentes).
 *
 * Os limites sao injetaveis para os testes; o default e o teto medido.
 * Quem adquire promete liberar: a funcao devolvida na liberacao tem de
 * rodar sempre (o `executar.ts` a chama em finally).
 */

import type { MotorEncode } from "./formato.js";
import { LIMITES_PADRAO } from "./formato.js";

export interface LimitesDaFila {
  nvenc: number;
  libx264: number;
}

export interface FilaDeEncode {
  /** Os limites em vigor (tetos do I-03 por default). */
  limites: LimitesDaFila;
  /** Sessoes ocupadas de um motor. */
  ocupados(motor: MotorEncode): number;
  /** Pedidos esperando vaga de um motor. */
  esperando(motor: MotorEncode): number;
  /**
   * Adquire uma sessao do motor. Resolve quando houver vaga; a promise
   * devolvida e a LIBERACAO — chame-a (uma vez) quando o encode terminar.
   */
  adquirir(motor: MotorEncode): Promise<() => void>;
}

/** Uma vaga prometida para um motor (o estado interno da fila). */
interface Vaga {
  liberada: boolean;
  despertar: () => void;
}

/**
 * Cria a fila explicita de sessoes. `limites` default = teto medido no
 * I-03 (4 NVENC + 4 libx264); os testes passam limites menores para
 * exercitar o bloqueio sem gastar 8 encodes reais.
 */
export function criarFilaDeEncode(
  limites: LimitesDaFila = { ...LIMITES_PADRAO },
): FilaDeEncode {
  const ocupadosPorMotor: Record<MotorEncode, number> = { nvenc: 0, libx264: 0 };
  const esperaPorMotor: Record<MotorEncode, Vaga[]> = { nvenc: [], libx264: [] };

  function agendarAcordar(motor: MotorEncode): void {
    // Sinaliza as vagas em espera, na ordem de chegada, enquanto houver
    // sessao livre. A vaga se auto-desocupa quando a promise de
    // liberacao for chamada — por isso o agendamento roda em microtask:
    // o adquirido so "existe" depois de o adquirente tomar posse.
    queueMicrotask(() => {
      while (
        ocupadosPorMotor[motor] < limites[motor] &&
        esperaPorMotor[motor].length > 0
      ) {
        const vaga = esperaPorMotor[motor].shift();
        if (vaga !== undefined) {
          ocupadosPorMotor[motor] += 1;
          vaga.liberada = false;
          vaga.despertar();
        }
      }
    });
  }

  return {
    limites,

    ocupados(motor) {
      return ocupadosPorMotor[motor];
    },

    esperando(motor) {
      return esperaPorMotor[motor].length;
    },

    adquirir(motor) {
      return new Promise<() => void>((resolve) => {
        const liberar = () => {
          if (ocupadosPorMotor[motor] > 0) {
            ocupadosPorMotor[motor] -= 1;
          }
          agendarAcordar(motor);
        };

        if (ocupadosPorMotor[motor] < limites[motor]) {
          ocupadosPorMotor[motor] += 1;
          resolve(liberar);
          return;
        }

        const vaga: Vaga = {
          liberada: false,
          despertar: () => resolve(liberar),
        };
        esperaPorMotor[motor].push(vaga);
      });
    },
  };
}
