/**
 * Gerador Terraform do rascunho cloud: `createContext` monta o estado e os
 * auxiliares; cada `files/<arquivo>.ts` emite a sua seção, na ordem dos
 * arquivos; aqui só se orquestra e se monta a saída (linhas por bloco).
 */
import { renderTop } from './hcl';
import { createContext } from './context';
import { emitProviders } from './files/providers';
import { emitVariables } from './files/variables';
import { emitIam } from './files/iam';
import { emitNetwork } from './files/network';
import { emitSecurity } from './files/security';
import { emitCompute } from './files/compute';
import { emitData } from './files/data';
import { emitEdge } from './files/edge';
import { emitObservability } from './files/observability';
import { emitOutputs } from './files/outputs';
import {
  TERRAFORM_FILES,
  type TerraformBlock,
  type TerraformFile,
  type TerraformInput,
  type TerraformOutput,
} from './shared';

export {
  BLOCKING_KEYS,
  dnsName,
  TERRAFORM_FILES,
  tfSlug,
  type IamTemplateLite,
  type TerraformBlock,
  type TerraformFile,
  type TerraformInput,
  type TerraformOutput,
  type TerraformTodo,
} from './shared';

export function generateTerraform(input: TerraformInput): TerraformOutput {
  const ctx = createContext(input);
  emitProviders(ctx);
  emitVariables(ctx);
  emitIam(ctx);
  emitNetwork(ctx);
  emitSecurity(ctx);
  emitCompute(ctx);
  emitData(ctx);
  emitEdge(ctx);
  emitObservability(ctx);
  emitOutputs(ctx);
  const { t, todos, chunks } = ctx;

  // --- montagem dos arquivos (linhas de cada bloco, para filtrar por elemento)
  const files: TerraformFile[] = TERRAFORM_FILES.map((path) => {
    const lines = [`# ${t.header[path]}`, `# ${t.generated}`, ''];
    const blocks: TerraformBlock[] = [];
    chunks[path].forEach((chunk, index) => {
      if (index > 0) lines.push('');
      const text = renderTop(chunk.entries).split('\n');
      const startLine = lines.length + 1;
      lines.push(...text);
      blocks.push({
        resourceIds: chunk.resourceIds,
        startLine,
        endLine: lines.length,
      });
    });
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return { path, content: `${lines.join('\n')}\n`, blocks };
  });
  return { files, todos };
}
