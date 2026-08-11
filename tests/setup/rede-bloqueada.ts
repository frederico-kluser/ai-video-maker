/**
 * tests/setup/rede-bloqueada.ts
 *
 * Setup do vitest: instala o guarda de rede antes de qualquer teste.
 *
 * Carregado por `vitest.config.ts` (`test.setupFiles`), ou seja: vale
 * para TODA a suite, nao apenas para os testes de resolucao. Um guarda
 * opcional, ligado teste a teste, protege exatamente os testes que ja
 * eram cuidadosos.
 *
 * Isto e a camada de dentro. A camada de fora e o namespace de rede em
 * `tools/resolucao/offline.sh` (`unshare --net`), que vale tambem para
 * subprocesso. As duas juntas respondem "a suite bloqueia a rede ou so
 * nao a usa?" com um comando executavel.
 */

import { bloquearRede } from "../../src/resolucao/rede/bloqueio.js";

bloquearRede({ permitirLoopback: false });
