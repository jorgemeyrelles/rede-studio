/** Tarefa individual dentro de uma fase do SOW */
export interface SowTask {
  label: string
}

/** Fase do cronograma de implantação */
export interface SowPhase {
  num: string
  cssClass: string
  title: string
  titleColor: string
  tasks: SowTask[]
}

/** Métrica de resumo exibida no rodapé do SOW */
export interface SowMetric {
  value: string
  label: string
}
