const getDiffDays = (isoString: string): { date: Date; diffDays: number } => {
  const date = new Date(isoString);
  const now = new Date();
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = Math.abs(nowDay.getTime() - dateDay.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return { date, diffDays };
};

const formatByDays = (date: Date, diffDays: number, todayFormat: () => string): string => {
  if (diffDays === 0) return todayFormat();
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

// Used in the sidebar chat list — shows time if today, else relative label
export const formatRelativeDate = (isoString?: string): string => {
  if (!isoString) return '';
  const { date, diffDays } = getDiffDays(isoString);
  return formatByDays(date, diffDays, () =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
};

// Used in the chat area message separators — shows "Today" instead of a time
export const formatMessageGroupDate = (isoString: string): string => {
  const { date, diffDays } = getDiffDays(isoString);
  return formatByDays(date, diffDays, () => 'Today');
};
