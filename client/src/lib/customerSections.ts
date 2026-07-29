import { createSectionResolver } from './sectionResolver';

export const customerSections = ['home', 'orders', 'contracts', 'documents', 'deposit', 'blacklist', 'representatives', 'profile', 'announcements'] as const;
export type CustomerSection = typeof customerSections[number];

// For individual customers, the default section is 'announcements'
// When representativeModeEnabled, additional sections are available: principal-orders, principal-contracts, principal-documents
export const individualCustomerSections = ['announcements', 'templates', 'principals', 'principal-orders', 'principal-contracts', 'principal-documents', 'profile'] as const;
export type IndividualCustomerSection = typeof individualCustomerSections[number];

export const customerSectionResolver = createSectionResolver(customerSections, 'home');
export const individualCustomerSectionResolver = createSectionResolver(individualCustomerSections, 'announcements');

export const { isValidSection: isValidCustomerSection, resolveSection: resolveCustomerSection } = customerSectionResolver;
