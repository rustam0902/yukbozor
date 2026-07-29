import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { transportTypes } from '@shared/transport-types';

interface TransportTypeSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  language: 'ru' | 'uz';
  placeholder?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

export function TransportTypeSelect({
  value,
  onValueChange,
  language,
  placeholder,
  disabled,
  'data-testid': testId,
}: TransportTypeSelectProps) {
  const selectedType = transportTypes.find(t => t.value === value);
  
  return (
    <Select onValueChange={onValueChange} value={value} disabled={disabled}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder={placeholder}>
          {selectedType && (
            <span>{language === 'ru' ? selectedType.labelRu : selectedType.labelUz}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {transportTypes.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            {language === 'ru' ? type.labelRu : type.labelUz}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
