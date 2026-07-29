import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
  maxDisplayItems?: number;
  "data-testid"?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  allLabel = "All",
  className,
  maxDisplayItems = 2,
  "data-testid": testId
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  const selectedItems = options.filter(opt => value.includes(opt.value));
  const hasSelection = selectedItems.length > 0;

  const handleToggle = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleSelectAll = () => {
    if (selectedItems.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.value));
    }
  };

  const displayValue = () => {
    if (!hasSelection) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    if (selectedItems.length <= maxDisplayItems) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedItems.map(item => (
            <Badge 
              key={item.value} 
              variant="secondary" 
              className="text-xs px-1.5 py-0"
            >
              {item.label}
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <span className="text-sm">
        {selectedItems.length} selected
      </span>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal min-h-9",
            !hasSelection && "text-muted-foreground",
            className
          )}
          data-testid={testId}
        >
          <div className="flex-1 text-left truncate">
            {displayValue()}
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {hasSelection && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0" 
        align="start"
        style={{ width: triggerWidth }}
      >
        <div className="p-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sm"
            onClick={handleSelectAll}
          >
            <Checkbox
              checked={selectedItems.length === options.length}
              className="mr-2"
            />
            {allLabel}
          </Button>
        </div>
        <div className="max-h-60 overflow-y-auto">
          <div className="p-2 space-y-1">
            {options.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm font-normal"
                onClick={() => handleToggle(option.value)}
                data-testid={`${testId}-option-${option.value}`}
              >
                <Checkbox
                  checked={value.includes(option.value)}
                  className="mr-2"
                />
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MultiSelect;
