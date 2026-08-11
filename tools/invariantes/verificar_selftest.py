#!/usr/bin/env python3
"""tools/invariantes/verificar_selftest.py — Autoteste do verificador de invariantes.

Roda ANTES do verificador, nao depois.
Cada invariante e testado com mutacao calculada do documento corrente:
- Cria uma copia temporaria do repositorio
- Introduz uma mutacao que DEVE disparar o invariante
- Executa o invariante e asserta que ele acusa a violacao
- Asserta a MENSAGEM, nao apenas o exit code

Regras (fonte: falsifiable-gates SKILL.md):
- Mutacao calculada, nunca literal: literal vira no-op no primeiro merge.
- Asserta a mensagem: um autoteste que so olha exit code nao distingue
  "acusou" de "quebrou".
- Falha fechado: recusa o que nao sabe analisar.
"""

import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import List, Tuple

# ---------------------------------------------------------------------------
# Cores
# ---------------------------------------------------------------------------

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[0;33m"
NC = "\033[0m"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASSED = 0
FAILED = 0


def _assert_contains(label: str, haystack: str, needle: str) -> None:
    global PASSED, FAILED
    if needle in haystack:
        print(f"  {GREEN}OK{NC} {label}")
        PASSED += 1
    else:
        print(f"  {RED}FALHOU{NC} {label}")
        print(f"       esperado conter: {needle}")
        print(f"       recebido (cabeca): {haystack[:200]}")
        FAILED += 1


def _assert_not_contains(label: str, haystack: str, needle: str) -> None:
    global PASSED, FAILED
    if needle not in haystack:
        print(f"  {GREEN}OK{NC} {label}")
        PASSED += 1
    else:
        print(f"  {RED}FALHOU{NC} {label}")
        print(f"       nao deveria conter: {needle}")
        print(f"       recebido (cabeca): {haystack[:200]}")
        FAILED += 1


def _run_verificar(raiz: Path, invariante: str) -> Tuple[int, str, str]:
    """Executa verificar.py para um invariante especifico.
    Retorna (exit_code, stdout, stderr)."""
    import subprocess

    verificar_path = raiz / "tools" / "invariantes" / "verificar.py"
    result = subprocess.run(
        [sys.executable, str(verificar_path), "--raiz", str(raiz), "--invariante", invariante],
        capture_output=True,
        text=True,
        cwd=str(raiz),
    )
    return result.returncode, result.stdout, result.stderr


# ---------------------------------------------------------------------------
# Teste 1: I01 — testes sem job devem ser detectados
# ---------------------------------------------------------------------------

def test_i01_testes_sem_job(raiz_original: Path) -> None:
    print("=== Teste I01: Diretorio de teste sem job → FAIL ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # Mutacao calculada: cria um diretorio de teste que nenhum job referencia
        tests_dir = repo / "tests" / "sem_job_xyz_123"
        tests_dir.mkdir(parents=True, exist_ok=True)
        (tests_dir / "test_nada.py").write_text("def test_nada(): pass\n")

        rc, stdout, stderr = _run_verificar(repo, "I01")

        _assert_contains("I01: contem [FAIL]", stdout, "[FAIL]")
        _assert_contains("I01: nomeia o diretorio sem job", stdout, "sem_job_xyz_123")
        _assert_contains("I01: contem 'sem job'", stdout, "sem job")
        _assert_not_contains("I01: nao contem [PASS]", stdout, "[PASS]")
    print()


# ---------------------------------------------------------------------------
# Teste 2: I02 — literal de token fora de src/design/
# ---------------------------------------------------------------------------

def test_i02_token_fora_de_design(raiz_original: Path) -> None:
    print("=== Teste I02: Literal de token fora de src/design/ → FAIL ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # Mutacao calculada: insere um literal de cor hex em src/contratos/manifesto.ts
        manifesto = repo / "src" / "contratos" / "manifesto.ts"
        conteudo = manifesto.read_text()
        # Adiciona uma linha com cor literal
        mutado = conteudo + '\nconst corProibida = "#FF0000"; // MUTACAO-CALCULADA\n'
        manifesto.write_text(mutado)

        rc, stdout, stderr = _run_verificar(repo, "I02")

        _assert_contains("I02: contem [FAIL]", stdout, "[FAIL]")
        _assert_contains("I02: nomeia cor hexadecimal", stdout, "Cor hexadecimal")
        _assert_contains("I02: contem '#FF0000'", stdout, "#FF0000")
        _assert_not_contains("I02: nao contem [PASS]", stdout, "[PASS]")
    print()


# ---------------------------------------------------------------------------
# Teste 3: I03 — URL remota em manifesto-resolvido.json
# ---------------------------------------------------------------------------

def test_i03_url_em_manifesto_resolvido(raiz_original: Path) -> None:
    print("=== Teste I03: URL remota em manifesto-resolvido.json → FAIL ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # Mutacao calculada: cria um manifesto-resolvido.json com URL
        gm_dir = repo / "fixtures" / "gm"
        gm_dir.mkdir(parents=True, exist_ok=True)
        manifesto_path = gm_dir / "manifesto-resolvido.json"
        manifesto_path.write_text(
            '{"schema_version": "Manifesto.1", "fps": 30, "width": 1920, "height": 1080, '
            '"nos": [{"id": "n1", "type": "texto", "schema": "Texto.1", "texto": "teste", '
            '"duracao_frames": 60}], "cenas": [{"id": "c1", "nos": ["n1"]}], '
            '"audio": {"trilha_sonora": "https://cdn.exemplo.com/musica.mp3"}}\n'
        )

        rc, stdout, stderr = _run_verificar(repo, "I03")

        _assert_contains("I03: contem [FAIL]", stdout, "[FAIL]")
        _assert_contains("I03: nomeia a URL", stdout, "https://cdn.exemplo.com")
        _assert_not_contains("I03: nao contem [PASS]", stdout, "[PASS]")
    print()


# ---------------------------------------------------------------------------
# Teste 4: I04 — nao-determinismo em src/composicao/
# ---------------------------------------------------------------------------

def test_i04_nao_determinismo_em_composicao(raiz_original: Path) -> None:
    print("=== Teste I04: Date.now() em src/composicao/ → FAIL ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # Mutacao calculada: cria src/composicao/ com um arquivo contendo Date.now()
        comp_dir = repo / "src" / "composicao"
        comp_dir.mkdir(parents=True, exist_ok=True)
        (comp_dir / "tempo.ts").write_text(
            'export function agora(): number {\n'
            '  return Date.now(); // MUTACAO-CALCULADA\n'
            '}\n'
        )

        rc, stdout, stderr = _run_verificar(repo, "I04")

        _assert_contains("I04: contem [FAIL]", stdout, "[FAIL]")
        _assert_contains("I04: nomeia Date.now()", stdout, "Date.now()")
        _assert_contains("I04: contem 'nao-deterministic'", stdout, "nao-deterministic")
        _assert_not_contains("I04: nao contem [PASS]", stdout, "[PASS]")
    print()


# ---------------------------------------------------------------------------
# Teste 5: I05 — ids de composicao duplicados
# ---------------------------------------------------------------------------

def test_i05_ids_duplicados(raiz_original: Path) -> None:
    print("=== Teste I05: Ids de composicao duplicados → FAIL ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # Mutacao calculada: cria Root.tsx com dois <Composition> com o mesmo id
        comp_dir = repo / "src" / "composicao"
        comp_dir.mkdir(parents=True, exist_ok=True)
        (repo / "src" / "Root.tsx").write_text(
            'import { Composition } from "remotion";\n'
            'import { CenaPrincipal } from "./composicao/raiz";\n'
            'import { OutraCena } from "./composicao/outra";\n'
            'export const RemotionRoot: React.FC = () => (\n'
            '  <>\n'
            '    <Composition id="cena-principal" component={CenaPrincipal} durationInFrames={300} fps={30} width={1920} height={1080} />\n'
            '    <Composition id="cena-principal" component={OutraCena} durationInFrames={150} fps={30} width={1920} height={1080} />\n'
            '  </>\n'
            ');\n'
        )

        rc, stdout, stderr = _run_verificar(repo, "I05")

        _assert_contains("I05: contem [FAIL]", stdout, "[FAIL]")
        _assert_contains("I05: nomeia 'cena-principal'", stdout, "cena-principal")
        _assert_contains("I05: contem 'duplicado'", stdout, "duplicado")
        _assert_not_contains("I05: nao contem [PASS]", stdout, "[PASS]")
    print()


# ---------------------------------------------------------------------------
# Teste 6: I06 — segredo literal detectado
# ---------------------------------------------------------------------------

def test_i06_segredo_literal(raiz_original: Path) -> None:
    print("=== Teste I06: API key literal → FAIL ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # Mutacao calculada: insere uma API key falsa (formato OpenAI) em um arquivo
        scripts_dir = repo / "scripts"
        scripts_dir.mkdir(parents=True, exist_ok=True)
        (scripts_dir / "config.ts").write_text(
            '// Configuracao do projeto\n'
            'const config = {\n'
            '  apiKey: "sk-1234567890abcdef1234567890abcdef", // MUTACAO-CALCULADA\n'
            '};\n'
            'export default config;\n'
        )

        rc, stdout, stderr = _run_verificar(repo, "I06")

        _assert_contains("I06: contem [FAIL]", stdout, "[FAIL]")
        _assert_contains("I06: nomeia openai-key", stdout, "openai-key")
        _assert_contains("I06: contem 'segredo'", stdout, "segredo")
        _assert_not_contains("I06: nao contem [PASS]", stdout, "[PASS]")
    print()


# ---------------------------------------------------------------------------
# Teste 7: I07 — ausencia de removido (item reencontrado)
# ---------------------------------------------------------------------------

def test_i07_ausencia_de_removido(raiz_original: Path) -> None:
    print("=== Teste I07: Item removido reencontrado → FAIL (NAO-EXERCITADO se lista vazia) ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # Mutacao calculada: injeta um item removido na lista do proprio verificador
        # e em seguida cria o arquivo que deveria estar ausente
        verificar_path = repo / "tools" / "invariantes" / "verificar.py"
        conteudo = verificar_path.read_text()

        # Substitui a lista vazia por uma com um item
        mutado = conteudo.replace(
            "itens_removidos: List[Tuple[str, str, str]] = []",
            'itens_removidos: List[Tuple[str, str, str]] = [\n'
            '        ("docs/arquivo-removido-por-adr-9999.md", "ADR-9999", "Documento removido por ADR-9999"),\n'
            '    ]'
        )
        verificar_path.write_text(mutado)

        # Cria o arquivo que deveria estar ausente
        (repo / "docs" / "arquivo-removido-por-adr-9999.md").write_text(
            "# Este arquivo foi removido por ADR-9999\n"
            "MUTACAO-CALCULADA: reapareceu indevidamente.\n"
        )

        rc, stdout, stderr = _run_verificar(repo, "I07")

        _assert_contains("I07: contem [FAIL]", stdout, "[FAIL]")
        _assert_contains("I07: nomeia ADR-9999", stdout, "ADR-9999")
        _assert_contains("I07: contem 'removido'", stdout, "removido")
        _assert_not_contains("I07: nao contem [PASS]", stdout, "[PASS]")
    print()


# ---------------------------------------------------------------------------
# Teste 8: Mensagens de NAO-EXERCITADO
# ---------------------------------------------------------------------------

def test_nao_exercitado_mensagens(raiz_original: Path) -> None:
    print("=== Teste NAO-EXERCITADO: Mensagens de alvo inexistente ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # I04: src/composicao/ nao existe
        # Remove src/composicao/ se existir
        comp_dir = repo / "src" / "composicao"
        if comp_dir.exists():
            shutil.rmtree(comp_dir)

        rc, stdout, stderr = _run_verificar(repo, "I04")
        _assert_contains("NAO-EXERCITADO I04: contem [NAO-EXERCITADO]", stdout, "[NAO-EXERCITADO]")
        _assert_contains("NAO-EXERCITADO I04: contem 'nao existe'", stdout, "nao existe")

        # I07: lista vazia
        rc, stdout, stderr = _run_verificar(repo, "I07")
        _assert_contains("NAO-EXERCITADO I07: contem [NAO-EXERCITADO]", stdout, "[NAO-EXERCITADO]")
        _assert_contains("NAO-EXERCITADO I07: contem 'nenhum item'", stdout, "nenhum item")
    print()


# ---------------------------------------------------------------------------
# Teste 9: PASS em repositorio limpo
# ---------------------------------------------------------------------------

def test_pass_em_repositorio_limpo(raiz_original: Path) -> None:
    print("=== Teste PASS: Repositorio limpo passa nos invariantes ativos ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "repo"
        shutil.copytree(raiz_original, repo, symlinks=False,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "dist", "output", ".remotion", ".cache", "__pycache__"))

        # Verifica os invariantes que devem estar ativos
        # I01: tests/ tem diretorios com job
        rc, stdout, stderr = _run_verificar(repo, "I01")
        _assert_not_contains("PASS I01: nao contem [FAIL]", stdout, "[FAIL]")

        # I02: src/ sem literais fora de design/
        rc, stdout, stderr = _run_verificar(repo, "I02")
        _assert_not_contains("PASS I02: nao contem [FAIL]", stdout, "[FAIL]")

        # I06: sem segredos
        rc, stdout, stderr = _run_verificar(repo, "I06")
        _assert_not_contains("PASS I06: nao contem [FAIL]", stdout, "[FAIL]")
    print()


# ---------------------------------------------------------------------------
# Teste 10: Verificador completo roda sem argumentos
# ---------------------------------------------------------------------------

def test_verificador_completo(raiz_original: Path) -> None:
    print("=== Teste Verificador Completo: Todos os invariantes rodam ===")

    import subprocess
    verificar_path = raiz_original / "tools" / "invariantes" / "verificar.py"

    result = subprocess.run(
        [sys.executable, str(verificar_path), "--raiz", str(raiz_original)],
        capture_output=True,
        text=True,
    )

    stdout = result.stdout
    # Deve listar todos os 7 invariantes
    _assert_contains("Completo: contem I01", stdout, "I01")
    _assert_contains("Completo: contem I02", stdout, "I02")
    _assert_contains("Completo: contem I03", stdout, "I03")
    _assert_contains("Completo: contem I04", stdout, "I04")
    _assert_contains("Completo: contem I05", stdout, "I05")
    _assert_contains("Completo: contem I06", stdout, "I06")
    _assert_contains("Completo: contem I07", stdout, "I07")
    _assert_contains("Completo: contem 'Total: 7'", stdout, "Total: 7")
    _assert_contains("Completo: contem 'VERMELHO' ou 'AMARELO' ou 'VERDE'",
                     stdout, "VERMELHO" if "VERMELHO" in stdout else "AMARELO" if "AMARELO" in stdout else "VERDE")
    print()


# =============================================================================
# Main
# =============================================================================

def main() -> None:
    global PASSED, FAILED

    # Encontra a raiz do repositorio (3 niveis acima de tools/invariantes/)
    script_dir = Path(__file__).resolve().parent
    raiz_original = script_dir.parent.parent  # tools/invariantes/ -> tools/ -> raiz

    print("=" * 60)
    print("Autoteste do Verificador de Invariantes")
    print(f"Raiz: {raiz_original}")
    print("=" * 60)
    print()

    testes = [
        ("I01 — testes sem job", test_i01_testes_sem_job),
        ("I02 — token fora de design", test_i02_token_fora_de_design),
        ("I03 — URL em manifesto resolvido", test_i03_url_em_manifesto_resolvido),
        ("I04 — nao-determinismo em composicao", test_i04_nao_determinismo_em_composicao),
        ("I05 — ids duplicados", test_i05_ids_duplicados),
        ("I06 — segredo literal", test_i06_segredo_literal),
        ("I07 — ausencia de removido", test_i07_ausencia_de_removido),
        ("NAO-EXERCITADO — mensagens", test_nao_exercitado_mensagens),
        ("PASS — repositorio limpo", test_pass_em_repositorio_limpo),
        ("Verificador completo", test_verificador_completo),
    ]

    for nome, func in testes:
        try:
            func(raiz_original)
        except Exception as e:
            print(f"  {RED}ERRO{NC} {nome}: {e}")
            import traceback
            traceback.print_exc()
            FAILED += 1

    print("=" * 60)
    print(f"Resultado: {PASSED} passaram, {FAILED} falharam")

    if FAILED > 0:
        print(f"{RED}Autoteste: FALHOU{NC}")
        sys.exit(1)
    else:
        print(f"{GREEN}Autoteste: PASSOU{NC}")
        sys.exit(0)


if __name__ == "__main__":
    main()
