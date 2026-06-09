'use client';

/**
 * Password strength indicator component.
 * Shows a visual bar + label based on password complexity.
 */
export default function PasswordStrength({ password }) {
  if (!password) return null;

  const getStrength = (pw) => {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  };

  const score = getStrength(password);

  const levels = [
    { label: 'Very Weak', color: 'bg-red-500', width: 'w-1/5' },
    { label: 'Weak', color: 'bg-orange-500', width: 'w-2/5' },
    { label: 'Fair', color: 'bg-amber-400', width: 'w-3/5' },
    { label: 'Strong', color: 'bg-emerald-400', width: 'w-4/5' },
    { label: 'Very Strong', color: 'bg-emerald-500', width: 'w-full' },
  ];

  const level = levels[Math.min(score, levels.length) - 1] || levels[0];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${level.color} ${level.width} rounded-full transition-all duration-500`}
        />
      </div>
      <p className={`text-xs font-medium ${
        score <= 1 ? 'text-red-400' :
        score <= 2 ? 'text-orange-400' :
        score <= 3 ? 'text-amber-400' :
        'text-emerald-400'
      }`}>
        {level.label}
      </p>
    </div>
  );
}
