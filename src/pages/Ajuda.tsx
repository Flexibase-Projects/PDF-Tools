import { Link } from 'react-router-dom';
import {
  FiFileText,
  FiScissors,
  FiMinimize2,
  FiFile,
  FiArrowRight,
} from 'react-icons/fi';
import './PageStyles.css';
import './Ajuda.css';

const FERRAMENTAS = [
  {
    id: 'merge',
    title: 'Juntar & Organizar PDF',
    path: '/merge',
    icon: <FiFileText size={24} />,
    descricao:
      'Mescle múltiplos PDFs em um único arquivo ou reorganize as páginas de um PDF na ordem desejada.',
    passos: [
      'Clique em "Selecionar arquivos" ou arraste os PDFs para a área de upload. Você pode adicionar vários arquivos.',
      'Aguarde o carregamento das páginas. Cada PDF aparecerá com uma cor diferente na pré-visualização.',
      'Arraste as páginas na área de pré-visualização para alterar a ordem. A ordem na tela será a ordem no PDF final.',
      'Passe o mouse sobre uma página e use o ícone de remover (X) se quiser excluir essa página do resultado.',
      'Para remover um arquivo inteiro da lista, use o X ao lado do nome do arquivo no cabeçalho.',
      'Quando estiver satisfeito com a ordem, clique em "Baixar PDF" para gerar e baixar o arquivo mesclado.',
    ],
  },
  {
    id: 'split',
    title: 'Dividir PDF',
    path: '/split',
    icon: <FiScissors size={24} />,
    descricao:
      'Extraia um intervalo de páginas, uma página única ou separe cada página em um PDF independente.',
    passos: [
      'Envie um único arquivo PDF pela área de upload.',
      'Escolha o modo: "Intervalo de páginas" (da página X à Y), "Página única" (apenas uma página) ou "Cada página" (um PDF por página).',
      'No intervalo, informe a página inicial e final. Na página única, informe o número da página.',
      'Se quiser receber vários PDFs em um único arquivo ZIP, marque "Baixar como ZIP".',
      'Clique em "Baixar" para processar. Você receberá um ou mais PDFs (ou um ZIP) conforme as opções escolhidas.',
    ],
  },
  {
    id: 'compress',
    title: 'Comprimir PDF',
    path: '/compress',
    icon: <FiMinimize2 size={24} />,
    descricao:
      'Reduza o tamanho do arquivo PDF ajustando a qualidade da compressão, ideal para envio por e-mail ou armazenamento.',
    passos: [
      'Envie um arquivo PDF pela área de upload.',
      'Use o controle deslizante "Qualidade" para definir o nível de compressão: maior qualidade mantém o arquivo maior; menor qualidade reduz mais o tamanho.',
      'A interface mostra o tamanho original e uma estimativa do tamanho após a compressão.',
      'Clique em "Baixar PDF comprimido" para processar e baixar o novo arquivo. O processamento é feito no navegador.',
    ],
  },
  {
    id: 'word',
    title: 'PDF para Word',
    path: '/word',
    icon: <FiFile size={24} />,
    descricao:
      'Converta um PDF em documento Word (DOCX) editável, preservando estrutura e formatação quando possível.',
    passos: [
      'Envie um único arquivo PDF pela área de upload.',
      'Confira o nome e o tamanho do arquivo na tela. Use "Trocar PDF" se quiser outro arquivo.',
      'Clique em "Converter e baixar" para iniciar a conversão. O arquivo DOCX será gerado e baixado automaticamente.',
      'Abra o DOCX no Microsoft Word ou em outro editor compatível para editar o conteúdo.',
    ],
  },
];

const Ajuda = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Como usar o PDF Tools</h1>
        <p>
          Guia rápido de cada ferramenta disponível. Clique no nome da ferramenta
          para ir direto até ela.
        </p>
      </div>

      <div className="ajuda-content">
        {FERRAMENTAS.map((ferramenta) => (
          <section key={ferramenta.id} className="ajuda-section">
            <div className="ajuda-section-header">
              <span className="ajuda-section-icon">{ferramenta.icon}</span>
              <div className="ajuda-section-title-wrap">
                <Link to={ferramenta.path} className="ajuda-section-link">
                  {ferramenta.title}
                  <FiArrowRight size={16} className="ajuda-section-arrow" />
                </Link>
                <p className="ajuda-section-desc">{ferramenta.descricao}</p>
              </div>
            </div>
            <ol className="ajuda-passos">
              {ferramenta.passos.map((passo, index) => (
                <li key={index}>{passo}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
};

export default Ajuda;
