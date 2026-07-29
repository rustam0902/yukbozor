export function createSectionResolver<const T extends readonly string[]>(
  sections: T,
  defaultSection: T[number]
) {
  type Section = T[number];
  
  // Type guard
  function isValidSection(section: string): section is Section {
    return sections.some(candidate => candidate === section);
  }
  
  // Resolver function
  function resolveSection(section?: string): Section | null {
    if (!section) return defaultSection;
    return isValidSection(section) ? section : null;
  }
  
  return {
    isValidSection,
    resolveSection,
    sections, // Expose for tests/consumers
  };
}
