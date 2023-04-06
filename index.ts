type State = {
  input: HTMLInputElement;
  span: HTMLSpanElement;
  div: HTMLDivElement;
  stack: number[];
  funcs: { [key: string]: string[] };
  func: string[];
  print: (text: string) => void;
  loop: boolean;
  inFunc: boolean;
  inString: boolean;
  inRemark: boolean;
  ifDepth: number;
};

const core = `
: dup 0 pick ;
: ?dup dup if dup then ;
: drop 0 pop ;
: swap 1 pick 2 pop ;
: over 1 pick ;
: 2dup over over ;
: 2drop drop drop ;
: rot 2 pick 3 pop ;
: -rot 2 pick 2 pick 3 pop 3 pop ;
: nip 1 pop ;
: tuck swap over ;

: f i 1 + dup =i . i 5 < ;
: loop-example 0 =i loop f ;`;

const DomLoad = () => {
  const input = document.querySelector("input")!;
  const span = document.querySelector("span")!;
  const div = document.querySelector("div")!;
  div.innerHTML = core.trim().split("\n").reverse().join("<br>");
  input.focus();
  const state: State = {
    ...{ input, span, div },
    ...{ stack: [], funcs: {}, loopStack: [] },
    ...{ func: [], ifDepth: 0 },
    ...{ loop: false, inFunc: false, inString: false, inRemark: false },
    print: (text: string) => {
      console.log(text);
      div.querySelector("line print")!.innerHTML += text;
    },
  };
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      run(state)(input!.value);
    }
  });
  core.split(/\s/g).forEach(exe(state));
};

const run = (state: State) => (code: string) => {
  const words = code.split(" ");
  state.input.readOnly = true;
  const ms = 100;
  state.div.innerHTML = `<line><print></print></line>${state.div.innerHTML}`;
  words.forEach((word, i) => {
    setTimeout(() => {
      exe(state)(word);
      state.div.querySelector("line")!.innerHTML += `${word} `;
      state.span.innerHTML = [...state.stack].reverse().join("\n");
      state.input.value = state.input.value.substring(word.length + 1);
    }, i * ms);
  });
  setTimeout(() => {
    state.input.readOnly = false;
    state.input.focus();
  }, words.length * ms);
};

const exe = (state: State) => (word: string) => {
  const { stack } = state;

  if (state.inRemark && word !== ")") return;
  if (word === "(") {
    state.inRemark = true;
    return;
  }
  if (word === ")") {
    state.inRemark = false;
    return;
  }

  if (state.loop) {
    state.loop = false;
    const func = state.funcs[word];
    if (func) {
      do func.forEach(exe(state));
      while (stack.pop()! !== 0);
    }
    return;
  }

  if (state.ifDepth) {
    state.ifDepth +=
      word === "if" ? 1 : ["then", "else"].includes(word) ? -1 : 0;
    return;
  }

  if (word === ":") {
    state.inFunc = true;
    return;
  }
  if (word === ";") {
    state.inFunc = false;
    state.funcs[state.func[0]!] = state.func.slice(1);
    state.func = [];
    return;
  }
  if (state.inFunc) {
    state.func.push(word);
    return;
  }
  const func = state.funcs[word];
  if (func) {
    func.forEach(exe(state));
    return;
  }

  if (/^\d+\.?\d*$/.test(word)) {
    stack.push(Number(word));
    return;
  }

  if (/^=\w+$/i.test(word)) {
    state.funcs[word.substring(1)] = [stack.pop()!.toString()];
    return;
  }

  const lquo = word.startsWith('"');
  const rquo = word.endsWith('"');
  if (lquo || rquo || state.inString) {
    if (lquo && !state.inString) state.inString = true;
    if (rquo && state.inString) state.inString = false;
    if (lquo) stack.push(0);
    else stack.push(" ".charCodeAt(0));
    stack.push(
      ...word
        .substring(lquo ? 1 : 0, rquo ? word.length - 1 : word.length)
        .split("")
        .map(c => c.charCodeAt(0))
    );
    if (rquo) stack.push(0);
    return;
  }

  const ops = [
    ...["=", "+", "-", "*", "/", "%"],
    ...["&", "|", "^", "<<", ">>", "<", ">"],
  ];
  if (ops.includes(word)) {
    const b = stack.pop()!;
    const a = stack.pop()!;
    stack.push(Number(eval(`${a}${word === "=" ? "===" : word}${b}`)));
    return;
  }

  switch (word) {
    case "pick":
      stack.push(stack.at(-stack.pop()! - 1) ?? Number.POSITIVE_INFINITY);
      break;
    case "pop":
      stack.splice(-stack.pop()! - 1, 1);
      break;
    case "if":
      if (stack.pop()! === 0) state.ifDepth = 1;
      break;
    case "else":
      state.ifDepth = 1;
      break;
    case "loop":
      state.loop = true;
      break;
    case ".":
      state.print(stack.pop()!.toString() + " ");
      break;
    case ".s":
      const idx = [...stack.slice(0, -1)].reverse().findIndex(n => n === 0);
      state.print(
        stack
          .slice(-idx - 1, -1)
          .map(x => String.fromCharCode(x))
          .join("")
      );
      stack.splice(-idx - 2);
      break;
  }
};
