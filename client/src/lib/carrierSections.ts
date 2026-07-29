import { createSectionResolver } from './sectionResolver';

export const carrierSections = ['home', 'orders', 'offers', 'contracts', 'documents', 'deposit', 'profile'] as const;
export type CarrierSection = typeof carrierSections[number];

export const carrierSectionResolver = createSectionResolver(carrierSections, 'home');
export const { isValidSection: isValidCarrierSection, resolveSection: resolveCarrierSection } = carrierSectionResolver;
