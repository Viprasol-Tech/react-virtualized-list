<p align="center">
  <img src="docs/assets/logo.png" width="120" alt="Viprasol Tech logo">
</p>

<h1 align="center">react-virtualized-list</h1>

<p align="center">
  <strong>Virtualized (windowed) list for React — render only the visible rows.</strong><br>
  Real windowing math with overscan, exposed as both a component and a pure helper.
</p>

<p align="center">
  <em>Built and maintained by <a href="https://viprasol.com">Viprasol Tech</a> — Fintech Experts. Full-Stack Builders.</em>
</p>

<p align="center">
  <a href="https://github.com/Viprasol-Tech/react-virtualized-list/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Viprasol-Tech/react-virtualized-list/ci.yml?style=flat-square&logo=githubactions&logoColor=white&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Viprasol-Tech/react-virtualized-list?style=flat-square&color=blue" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <a href="https://t.me/viprasol_help"><img src="https://img.shields.io/badge/Telegram-support-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegram"></a>
</p>

---

## ✨ Features

- 🚀 **Performance** — renders only visible rows + overscan, even for 100k items.
- 🧮 **Real windowing core** — `computeRange()` returns start/end/offset/total, fully tested.
- 🧩 **Component + helper** — `<VirtualList>` or use the math yourself.
- 🔒 **Strictly typed** — TypeScript `strict`, ships `.d.ts`.

## 📦 Install

```bash
npm install react-virtualized-list
```

## 🚀 Usage

```tsx
import { VirtualList } from "react-virtualized-list";

export function Demo() {
  const items = Array.from({ length: 100_000 }, (_, i) => `Row ${i}`);
  return (
    <VirtualList
      itemCount={items.length}
      itemHeight={32}
      height={400}
      renderItem={(index) => <div>{items[index]}</div>}
    />
  );
}
```

Pure helper:

```ts
import { computeRange } from "react-virtualized-list";
computeRange(scrollTop, itemHeight, viewport, itemCount, overscan);
```

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## Contact — Viprasol Tech Private Limited

- 🌐 Website: [viprasol.com](https://viprasol.com)
- ✉️ Email: [support@viprasol.com](mailto:support@viprasol.com)
- 💬 Telegram: [t.me/viprasol_help](https://t.me/viprasol_help) · 📱 WhatsApp: +91 96336 52112
- 🐙 GitHub: [@Viprasol-Tech](https://github.com/Viprasol-Tech) · 💼 [LinkedIn](https://www.linkedin.com/in/viprasol/) · 𝕏 [@viprasol](https://twitter.com/viprasol)

> *Viprasol Tech — fintech software, web & SaaS apps, algorithmic trading systems, and AI agents. Need a custom build? [Get in touch](mailto:support@viprasol.com).*

## License

[MIT](LICENSE) © 2025 Viprasol Tech Private Limited
