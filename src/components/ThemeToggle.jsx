import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center space-x-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700/50 transition-all duration-300"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600" />
      )}
      {/* Toggle track */}
      <div className="relative w-8 h-4 rounded-full bg-slate-300 dark:bg-slate-600 transition-colors duration-300">
        <div
          className={`absolute top-0.5 h-3 w-3 rounded-full shadow transition-all duration-300 ${
            isDark
              ? 'left-[18px] bg-blue-400'
              : 'left-0.5 bg-white'
          }`}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {isDark ? 'Dark Mode' : 'Light Mode'}
      </span>
    </button>
  );
}

export default ThemeToggle;
