import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUsageCounter, incrementUsageCounter } from '../services/counterService';

interface CounterContextType {
  count: number;
  increment: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CounterContext = createContext<CounterContextType | undefined>(undefined);

export const useCounter = () => {
  const context = useContext(CounterContext);
  if (!context) {
    throw new Error('useCounter must be used within CounterProvider');
  }
  return context;
};

interface CounterProviderProps {
  children: ReactNode;
}

export const CounterProvider = ({ children }: CounterProviderProps) => {
  const [count, setCount] = useState<number>(0);

  const refresh = async () => {
    const currentCount = await getUsageCounter();
    setCount(currentCount);
  };

  const increment = async () => {
    try {
      const newCount = await incrementUsageCounter();
      setCount(newCount);
    } catch (error) {
      console.error('Erro ao incrementar contador:', error);
      // Tentar atualizar mesmo em caso de erro
      await refresh();
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <CounterContext.Provider value={{ count, increment, refresh }}>
      {children}
    </CounterContext.Provider>
  );
};
