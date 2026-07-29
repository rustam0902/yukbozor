import { useState, useEffect, useRef, CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  expiresAt: string | null;
  language?: 'ru' | 'uz';
  onExpired?: () => void;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const texts = {
  ru: {
    expired: 'Истёк',
    hours: ' ч',
    minutes: ' мин',
    seconds: ' сек'
  },
  uz: {
    expired: 'Tugadi',
    hours: ' s',
    minutes: ' daq',
    seconds: ' son'
  }
};

export default function CountdownTimer({ 
  expiresAt, 
  language = 'ru',
  onExpired,
  showIcon = true,
  size = 'sm'
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const offsetRef = useRef<number>(0);

  const { data: serverTimeData } = useQuery<{ serverTime: string }>({
    queryKey: ['/api/server-time'],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  useEffect(() => {
    if (serverTimeData?.serverTime) {
      const serverTimestamp = new Date(serverTimeData.serverTime).getTime();
      const clientNow = Date.now();
      offsetRef.current = serverTimestamp - clientNow;
    }
  }, [serverTimeData]);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const adjustedNow = Date.now() + offsetRef.current;
      const expiryTime = new Date(expiresAt).getTime();
      const diff = expiryTime - adjustedNow;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        onExpired?.();
        return;
      }

      setIsExpired(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const t = texts[language];

  if (!expiresAt || timeLeft === null) {
    return null;
  }

  const formatTime = () => {
    if (isExpired) {
      return t.expired;
    }
    
    const parts = [];
    if (timeLeft.hours > 0) {
      parts.push(`${timeLeft.hours}${t.hours}`);
    }
    parts.push(`${timeLeft.minutes.toString().padStart(2, '0')}${t.minutes}`);
    parts.push(`${timeLeft.seconds.toString().padStart(2, '0')}${t.seconds}`);
    return parts.join(' ');
  };

  const getColorStyles = (): CSSProperties => {
    if (isExpired || (timeLeft.hours === 0 && timeLeft.minutes < 10)) {
      return {
        backgroundColor: '#dc2626',
        color: '#ffffff',
        borderColor: '#b91c1c',
      };
    }
    if (timeLeft.hours === 0 && timeLeft.minutes < 30) {
      return {
        backgroundColor: '#f59e0b',
        color: '#ffffff',
        borderColor: '#d97706',
      };
    }
    return {
      backgroundColor: '#059669',
      color: '#ffffff',
      borderColor: '#047857',
    };
  };

  const isUrgent = isExpired || (timeLeft.hours === 0 && timeLeft.minutes < 10);

  return (
    <div 
      className={`inline-flex items-center font-semibold rounded-md border ${size === 'sm' ? 'text-sm px-3 py-1' : 'text-base px-4 py-1.5'} whitespace-nowrap ${isUrgent ? 'animate-pulse' : ''}`}
      style={getColorStyles()}
      data-testid="countdown-timer"
    >
      {showIcon && <Clock className={`${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} />}
      {formatTime()}
    </div>
  );
}
