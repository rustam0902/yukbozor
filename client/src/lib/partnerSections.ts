import { createSectionResolver } from './sectionResolver';

export const partnerSections = ['home', 'clients', 'commissions', 'deposit', 'referral', 'profile'] as const;
export type PartnerSection = typeof partnerSections[number];

export const partnerSectionResolver = createSectionResolver(partnerSections, 'home');
export const { isValidSection: isValidPartnerSection, resolveSection: resolvePartnerSection } = partnerSectionResolver;
