"use client";

import { useEffect, useRef } from "react";

export interface MethodologyModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function MethodologyModal({
  isOpen,
  onClose,
}: Readonly<MethodologyModalProps>) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Safeguard against unexpected DOM state transitions
        }
      }
    } else if (dialog.open) {
      try {
        dialog.close();
      } catch {
        // Safeguard against unexpected DOM state transitions
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      // Native Escape triggers 'cancel' on modal dialogs.
      // Prevent browser default closing so React state manages dismissal deterministically.
      e.preventDefault();
      onCloseRef.current();
    };

    const handleDialogClick = (e: MouseEvent) => {
      // A click directly on the dialog backdrop (outside the inner content box)
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!isInside) {
        onCloseRef.current();
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("click", handleDialogClick);

    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("click", handleDialogClick);
      if (dialog.open) {
        try {
          dialog.close();
        } catch {
          // Safeguard on unmount
        }
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="methodology-modal"
      aria-labelledby="methodology-modal-title"
    >
      <div className="methodology-modal-content">
        <header className="methodology-modal-header">
          <div>
            <div className="modal-tag-row">
              <span
                className="data-origin-badge official"
                data-classification="official_reference"
              >
                Cenário oficial SGB
              </span>
              <span className="source-tag">SGB / CPRM · 2024</span>
            </div>
            <h2 id="methodology-modal-title">Fonte e metodologia</h2>
            <p className="methodology-modal-subtitle">
              Referencial hidrológico e cartográfico do Rio Pomba em Santo Antônio de Pádua, RJ
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar painel de metodologia"
          >
            ✕
          </button>
        </header>

        <div className="methodology-modal-body">
          <section className="modal-section">
            <h3>Estudo de referência oficial</h3>
            <p>
              As manchas de inundação exibidas no mapa são os polígonos oficiais
              publicados pelo <strong>Serviço Geológico do Brasil (SGB / CPRM)</strong> no
              estudo:
            </p>
            <blockquote className="modal-citation">
              <em>
                &ldquo;Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ&rdquo;
              </em>{" "}
              (SGB, 2024).
            </blockquote>
            <p>
              O mapeamento contempla <strong>11 cenários modelados</strong> entre{" "}
              <strong>300 cm (3,00 m)</strong> e <strong>550 cm (5,50 m)</strong>, em intervalos
              regulares de 25 cm, consultados diretamente do geosserviço oficial do SGB.
            </p>
            <a
              href="https://rigeo.sgb.gov.br/handle/doc/25035"
              target="_blank"
              rel="noreferrer"
              className="modal-external-link"
            >
              Acessar relatório técnico no repositório RiGeo (SGB) ↗
            </a>
          </section>

          <section className="modal-section">
            <h3>Estação fluviométrica e referencial altimétrico</h3>
            <div className="modal-data-grid">
              <div className="data-box">
                <span className="data-label">Estação de referência</span>
                <strong className="data-val">Santo Antônio de Pádua II</strong>
                <span className="data-sub">Código RHN / ANA: 58790002</span>
              </div>
              <div className="data-box">
                <span className="data-label">Zero da régua</span>
                <strong className="data-val">79,709 m</strong>
                <span className="data-sub">Altitude ortométrica</span>
              </div>
              <div className="data-box">
                <span className="data-label">Datum vertical</span>
                <strong className="data-val">hgeoHNOR_IMBITUBA</strong>
                <span className="data-sub">Marégrafo de Imbituba - SC</span>
              </div>
              <div className="data-box">
                <span className="data-label">Cotas contempladas</span>
                <strong className="data-val">3,00 m a 5,50 m</strong>
                <span className="data-sub">11 cenários a cada 25 cm</span>
              </div>
            </div>
            <p className="modal-note">
              A altitude ortométrica exibida para cada cenário corresponde à soma da cota local na
              régua da estação com o zero da régua (79,709 m), conforme o relatório do SGB.
            </p>
          </section>

          <section className="modal-section">
            <h3>Limites de interpretação e dados derivados</h3>
            <ul className="modal-bullets">
              <li>
                <strong>Extensão, não profundidade:</strong> A mancha delimita a{" "}
                <em>extensão horizontal estimada</em> da água para cada cota de referência. Ela{" "}
                <strong>não indica profundidade</strong>, velocidade da correnteza, dano ou risco
                individual a imóveis.
              </li>
              <li>
                <strong>Cenário estático, não situação atual:</strong> Selecionar uma cota no mapa
                não significa que o rio esteja naquele nível no momento nem constitui previsão.
              </li>
              <li>
                <strong>Área da mancha selecionada e comparação topológica (dado derivado):</strong>{" "}
                Calculadas sobre os polígonos oficiais efetivamente consultados por aproximação
                numérica em latitude autálica no elipsoide WGS84 com união e operações topológicas
                reais (<code>polygon-clipping</code>), distinguindo área comum (A ∩ B), exclusiva de
                A (A \ B) e exclusiva de B (B \ A) sem pressupor aninhamento perfeito, com validação
                de conservação de área e falha fechada em caso de geometria inválida. O gráfico das
                11 cotas utiliza o snapshot catalogado em 25/11/2026 com hashes registrados e sinaliza
                explicitamente qualquer divergência frente à geometria consultada ao vivo.
              </li>
              <li>
                <strong>Régua INEA vs. Cota de referência SGB — Pádua II (58790002):</strong> O
                monitoramento do INEA (estação 213042120 / ANA FLU 58774000, ~6 km a montante do
                centro) não aciona nem altera automaticamente a mancha SGB (estação 58790002), pois
                o zero da régua e o datum do INEA ainda não foram confirmados e a equivalência entre
                as estações não foi estabelecida.
              </li>
            </ul>
          </section>

          <section className="modal-section modal-disclaimer-box">
            <h3>Aviso institucional</h3>
            <p>
              <strong>
                Esta plataforma não substitui os alertas e as orientações dos órgãos oficiais.
              </strong>
            </p>
            <p>
              O <strong>Pádua FloodSim</strong> é uma iniciativa acadêmica de consulta hidrológica e
              cartográfica. Em situações de chuva forte ou cheia do Rio Pomba, acompanhe sempre a{" "}
              <strong>Defesa Civil Municipal de Santo Antônio de Pádua</strong>, o{" "}
              <strong>INEA</strong> e os boletins do <strong>SGB</strong>.
            </p>
          </section>
        </div>

        <footer className="methodology-modal-footer">
          <button
            type="button"
            className="modal-primary-btn"
            onClick={onClose}
          >
            Entendido, fechar
          </button>
        </footer>
      </div>
    </dialog>
  );
}
