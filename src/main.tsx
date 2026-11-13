import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Navigator {
    modelContext?: {
      registerTool?: (tool: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        execute: (args: Record<string, unknown>) => Promise< unknown>;
      }) => void;
      provideContext?: (ctx: { tools: unknown[] }) => void;
    };
  }
}

function registerWebMcpTools() {
  if (typeof navigator === 'undefined' || !navigator.modelContext?.registerTool) return;

  try {
    navigator.modelContext.registerTool({
      name: 'calculate_angola_invoice_taxes',
      description:
        'Calcula o resumo fiscal de uma factura em Angola em Kwanzas (AOA), incluindo IVA de 14%, Retenção na Fonte de 6,5% e desconto promocional Black Friday de 60%.',
      inputSchema: {
        type: 'object',
        properties: {
          grossAmountKz: {
            type: 'number',
            description: 'Valor ilíquido bruto em Kwanzas (AOA)',
          },
          applyBlackFriday60: {
            type: 'boolean',
            description: 'Aplicar desconto promocional Black Friday de 60%',
          },
          applyWithholding65: {
            type: 'boolean',
            description: 'Aplicar Retenção na Fonte de 6,5% (Imposto Industrial)',
          },
        },
        required: ['grossAmountKz'],
      },
      execute: async (args) => {
        const gross = Number(args?.grossAmountKz || 100000);
        const bf = Boolean(args?.applyBlackFriday60);
        const ret = args?.applyWithholding65 !== undefined ? Boolean(args.applyWithholding65) : true;
        const discount = bf ? gross * 0.6 : 0;
        const subtotal = gross - discount;
        const iva14 = subtotal * 0.14;
        const withholding65 = ret ? subtotal * 0.065 : 0;
        const totalWithIva = subtotal + iva14;
        const netPayable = totalWithIva - withholding65;
        return {
          currency: 'AOA',
          grossAmountKz: gross,
          discountTotalKz: discount,
          taxableSubtotalKz: subtotal,
          ivaRatePercent: 14,
          ivaAmountKz: iva14,
          withholdingRatePercent: ret ? 6.5 : 0,
          withholdingAmountKz: withholding65,
          totalInvoiceKz: totalWithIva,
          netPayableKz: netPayable,
        };
      },
    });
  } catch {
    // WebMCP already registered by index.html inline script
  }
}

registerWebMcpTools();

createRoot(document.getElementById('root')!).render(<App />);
