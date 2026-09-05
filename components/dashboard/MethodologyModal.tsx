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
      onClose();
    };

    const handleDialogClick = (e: MouseEvent) => {
      // A click directly on the dialog backdrop (outside the inner content box)
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInside) {
        onClose();
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
  }, [onClose]);

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
              <span className="classification-pill">official_reference</span>
              <span className="source-tag">SGB / CPRM · 2024</span>
            </div>
            <h2 id="methodology-modal-title">Fonte e metodologia científica</h2>
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
              As manchas de inundação apresentadas no mapa são os polígonos oficiais
              publicados pelo <strong>Serviço Geológico do Brasil (SGB / CPRM)</strong> no
              trabalho:
            </p>
            <blockquote className="modal-citation">
              <em>
                &ldquo;Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ&rdquo;
              </em>{" "}
              (SGB, 2024).
            </blockquote>
            <p>
              O produto hidrológico original contempla <strong>11 cenários modelados</strong> entre{" "}
              <strong>300 cm (3,00 m)</strong> e <strong>550 cm (5,50 m)</strong>, com intervalos
              regulares de 25 cm, disponibilizados via geosserviço oficial do SGB.
            </p>
            <a
              href="https://rigeo.sgb.gov.br/handle/doc/25035"
              target="_blank"
              rel="noreferrer"
              className="modal-external-link"
            >
              Acessar relatório técnico no repositório institucional RiGeo (SGB) ↗
            </a>
          </section>

          <section className="modal-section">
            <h3>Estação fluviométrica e referencial altimétrico</h3>
            <div className="modal-data-grid">
              <div className="data-box">
                <span className="data-label">Estação de referência</span>
                <strong className="data-val">Santo Antônio de Pádua II</strong>
                <span className="data-sub">Código RHN: 58790002</span>
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
              A altitude ortométrica exibida para cada cota é a soma da cota local lida na régua da estação
              com o zero da régua (79,709 m), conforme publicado na documentação do SGB.
            </p>
          </section>

          <section className="modal-section">
            <h3>Semântica cartográfica e científica</h3>
            <ul className="modal-bullets">
              <li>
                <strong>Extensão, não profundidade:</strong> A mancha poligonal delimita a{" "}
                <em>extensão horizontal estimada</em> da água para cada cota de referência. Ela{" "}
                <strong>não indica lâmina d&apos;água (profundidade)</strong>, velocidade da correnteza nem
                danos estruturais.
              </li>
              <li>
                <strong>Não é previsão meteorológica nem alerta de evacuação:</strong> Os cenários
                mostram o comportamento hidráulico estático modelado para cotas fixas, não uma estimativa de
                quando ou se o rio atingirá determinado patamar.
              </li>
              <li>
                <strong>Independência de modelos:</strong> Esta camada representa exclusivamente a
                referência oficial do SGB. Modelos numéricos experimentais próprios com Modelo Digital de
                Elevação (MDE/DEM) permanecem concebidos como camadas e artefatos distintos e independentes.
              </li>
              <li>
                <strong>Régua INEA vs. Cota SGB:</strong> O nível da estação de monitoramento do INEA
                (exibido a título demonstrativo) não é traduzido diretamente para as cotas SGB, pois a
                equivalência entre as referências de régua, estações e datums ainda não foi identificada e
                tecnicamente validada.
              </li>
            </ul>
          </section>

          <section className="modal-section modal-disclaimer-box">
            <h3>Caráter acadêmico e experimental</h3>
            <p>
              O <strong>Pádua FloodSim</strong> é uma iniciativa acadêmica voltada à pesquisa em modelagem
              hidrológica, cartografia computacional e visualização científica.
            </p>
            <p>
              <strong>Nunca utilize estas simulações para tomada de decisão em situações de emergência.</strong>{" "}
              Para alertas hidrológicos vigentes, instruções de evacuação e monitoramento oficial, consulte
              sempre a <strong>Defesa Civil Municipal de Santo Antônio de Pádua</strong>, o{" "}
              <strong>INEA</strong> e os boletins do <strong>SGB</strong>.
            </p>
            <p className="modal-internal-docs">
              Documentação técnica interna detalhada: <code>docs/ACADEMIC_METHODOLOGY.md</code> e{" "}
              <code>docs/DATA_SOURCES.md</code>.
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
