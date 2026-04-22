export type EquipmentCategory =
  | 'router'
  | 'firewall'
  | 'switch'
  | 'server'
  | 'access-point';
export type VendorBrand = 'cisco' | 'fortinet';

export interface EquipmentSpecification {
  parameter: string;
  value: string;
}

export interface Equipment {
  id: string;
  name: string;
  model: string;
  category: EquipmentCategory;
  vendor: VendorBrand;
  site: 'matriz' | 'filial' | 'both';
  quantity: number;
  imagePath: string;
  imageUrl?: string;
  description: string;
  specifications: EquipmentSpecification[];
  keyFeatures: string[];
  useCase: string;
  estimatedCost: string;
}

export interface EquipmentGroup {
  category: EquipmentCategory;
  categoryLabel: string;
  equipments: Equipment[];
}
