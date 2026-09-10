export interface FilialUserGrowthRow {
  scenario: string;
  quantity: string;
}

export interface FilialDepartmentRow {
  department: string;
  current: string;
  projected: string;
  withReserve: string;
  recommendedPrefix: string;
}

export interface FilialWanRow {
  link: string;
  technology: string;
  bandwidth: string;
  sla: string;
  protocol: string;
  addressing: string;
  notes: string;
}
