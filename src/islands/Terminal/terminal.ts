// Окно терминала (SPEC.md §7.11). Модуль грузится при первом открытии: до этого на странице только загрузчик
// из Terminal.astro. Разметка окна — из сборки, здесь — ввод, вывод и действия команд.

import { ui } from '../../data/resume';
import { applyTheme, currentTheme } from '../../lib/theme';
import { run, type Effect, type Line } from './commands';
import { complete } from './complete';
import { History } from './history';

function part<T extends Element>(root: Element, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`terminal: ${selector} is missing`);
  return el;
}

/** Подключает окно и возвращает функцию, которая его открывает. */
export function mount(dialog: HTMLDialogElement): () => void {
  const log = part<HTMLElement>(dialog, '[data-terminal-log]');
  const form = part<HTMLFormElement>(dialog, '[data-terminal-form]');
  const input = part<HTMLInputElement>(form, 'input');
  const prompt = part<HTMLElement>(form, '[data-terminal-prompt]');
  const past = new History();

  const line = (...nodes: (Node | string)[]) => {
    const p = document.createElement('p');
    p.className = 'line';
    p.append(...nodes);
    log.append(p);
    return p;
  };

  // Только textContent и атрибуты: вывод и эхо ввода никогда не разбираются как HTML.
  const print = (spans: Line) => {
    const p = line(
      ...spans.map((s) => {
        if (!s.href && !s.kind) return s.text;
        const el = s.href ? Object.assign(document.createElement('a'), { href: s.href }) : document.createElement('span');
        if (s.kind) el.className = `k-${s.kind}`;
        el.textContent = s.text;
        return el;
      }),
    );
    // Висячий отступ на ширину колонки: шрифт моноширинный, ch — ровно один знак.
    const first = spans[0];
    if (first?.hang) {
      p.style.paddingLeft = `${first.text.length}ch`;
      p.style.textIndent = `-${first.text.length}ch`;
    }
  };

  const echo = (text: string) => line(prompt.cloneNode(true), ' ', text);
  const toEnd = () => (log.scrollTop = log.scrollHeight);

  const apply = (effect: Effect) => {
    switch (effect.kind) {
      case 'clear':
        log.replaceChildren();
        break;
      case 'close':
        dialog.close();
        break;
      case 'navigate': {
        dialog.close();
        // После закрытия фокус возвращается на кнопку, прокрутка — уже после этого.
        requestAnimationFrame(() => {
          document.getElementById(effect.id)?.scrollIntoView();
          if (location.hash !== `#${effect.id}`) history.pushState(null, '', `#${effect.id}`);
        });
        break;
      }
      case 'download': {
        // Внутри окна: остальная страница при открытом модальном окне inert.
        const a = Object.assign(document.createElement('a'), { href: effect.href, download: '', hidden: true });
        dialog.append(a);
        a.click();
        a.remove();
        break;
      }
      case 'theme':
        applyTheme(effect.theme);
        break;
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    echo(value);
    past.push(value);
    const result = run(value, { theme: currentTheme() });
    result.lines.forEach(print);
    if (result.effect) apply(result.effect);
    toEnd();
  });

  input.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const value = e.key === 'ArrowUp' ? past.prev(input.value) : past.next();
      if (value === null) return;
      e.preventDefault();
      input.value = value;
      input.setSelectionRange(value.length, value.length);
    } else if (e.key === 'Tab' && !e.shiftKey && input.value.trim() !== '') {
      // Пустая строка Tab не перехватывает: фокус уходит к кнопке закрытия и ссылкам вывода.
      e.preventDefault();
      const { value, options } = complete(input.value);
      if (value === input.value && options.length > 1) {
        echo(input.value);
        print([{ text: options.join('  ') }]);
        toEnd();
      }
      input.value = value;
    }
  });

  part<HTMLButtonElement>(dialog, '[data-terminal-close]').addEventListener('click', () => dialog.close());

  dialog.addEventListener('click', (e) => {
    // Клик по подложке приходит на сам dialog с координатами вне окна.
    if (e.target === dialog) {
      const box = dialog.getBoundingClientRect();
      const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
      if (!inside) {
        dialog.close();
        return;
      }
    }
    // Клик по пустому месту окна — обратно в строку ввода, если не выделяли текст.
    if ((e.target as Element).closest('a, button, input')) return;
    if (window.getSelection()?.isCollapsed === false) return;
    input.focus({ preventScroll: true });
  });

  print([{ text: ui.terminal.welcome, kind: 'muted' }]);

  return () => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    toEnd();
  };
}
