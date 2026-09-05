import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Play,
  RotateCcw,
  Terminal,
} from "lucide-react";
import type { Lesson } from "../curriculum";
import {
  canCompleteLesson,
  verifyLesson,
  type LessonProgress,
} from "../learning";
import { normalizeCommand, runSimulatedCommand } from "../terminal";

type Props = {
  lesson: Lesson;
  index: number;
  step: number;
  progress: LessonProgress;
  onStep: (step: number) => void;
  onUpdate: (patch: Partial<LessonProgress>) => void;
  onComplete: () => void;
  onGlossary: () => void;
};

export function LessonView({
  lesson,
  index,
  step,
  progress,
  onStep,
  onUpdate,
  onComplete,
  onGlossary,
}: Props) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [displayRecords, setDisplayRecords] = useState(progress.records);
  useEffect(() => {
    setInput("");
    setFeedback("");
    setAnswer(null);
    setChecked(false);
    setDisplayRecords(progress.records);
  }, [lesson.id]);
  const run = (raw: string) => {
    const command = normalizeCommand(raw);
    if (!command) return;
    const result = runSimulatedCommand(command);
    if (result.output === "__CLEAR__") {
      setDisplayRecords([]);
      setFeedback("清空显示不会删除本课验收记录。");
      setInput("");
      return;
    }
    setDisplayRecords((records) => [
      ...records.slice(-49),
      { command, ...result },
    ]);
    const isLessonCommand = lesson.commands.some(
      (item) => normalizeCommand(item.command) === command,
    );
    if (isLessonCommand) {
      const records = [
        ...progress.records.filter((record) => record.command !== command),
        { command, ...result },
      ];
      onUpdate({
        records,
        commands: records
          .filter((record) => record.ok)
          .map((record) => record.command),
        verified: false,
        completed: false,
      });
    }
    setFeedback(
      isLessonCommand
        ? "模拟输出已更新。请对照用途和结果，确认你读懂了哪些信息。"
        : result.output,
    );
    setInput("");
  };
  const verify = () => {
    const result = verifyLesson(lesson, progress);
    onUpdate({ verified: result.passed });
    if (result.passed) {
      setFeedback("本课模拟记录通过检查。");
      onStep(2);
    } else
      setFeedback(
        `请先完成本课全部命令并检查输出。${result.missingCommands.length ? `还有 ${result.missingCommands.length} 条命令未完成。` : "部分输出缺少预期证据。"}`,
      );
  };
  const selectedAnswer = progress.quiz ? lesson.quiz.correct : answer;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="metadata">
            课程 {index + 1} / 5 · {lesson.duration}
          </p>
          <h1>{lesson.title}</h1>
          <p>{lesson.outcome}</p>
        </div>
        <button className="secondary-button" onClick={onGlossary}>
          <CircleHelp />
          查术语
        </button>
      </div>
      <div className="mode-note">
        <span className="badge sample">模拟练习</span>
        <span>本课输出为教学样例，不代表你的电脑或集群状态。</span>
      </div>
      <nav className="lesson-steps" aria-label="本课步骤">
        {["理解概念", "练习命令", "判断证据"].map((label, position) => (
          <button
            key={label}
            aria-current={step === position ? "step" : undefined}
            onClick={() => onStep(position)}
          >
            <span>
              {(position === 0 && progress.concept) ||
              (position === 1 && progress.verified) ||
              (position === 2 && progress.completed) ? (
                <Check />
              ) : (
                position + 1
              )}
            </span>
            {label}
          </button>
        ))}
      </nav>
      {step === 0 && (
        <section className="lesson-content" aria-label="理解概念">
          <h2>先建立这个概念</h2>
          <p className="reading-copy">{lesson.why}</p>
          <dl className="concept-list">
            {lesson.concepts.map((concept) => (
              <div key={concept.term}>
                <dt>
                  <strong>{concept.term}</strong>
                  <span>{concept.plain}</span>
                </dt>
                <dd>{concept.detail}</dd>
              </div>
            ))}
          </dl>
          <details className="reading-note">
            <summary>容易混淆的地方</summary>
            <ul>
              {lesson.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </details>
          <div className="step-footer">
            <span>
              {progress.concept
                ? "概念阅读已完成"
                : "下一步：观察命令返回了什么"}
            </span>
            <button
              className="primary-button"
              onClick={() => {
                onUpdate({ concept: true });
                onStep(1);
              }}
            >
              理解了，开始练习
              <ArrowRight />
            </button>
          </div>
        </section>
      )}
      {step === 1 && (
        <section className="lesson-content" aria-label="练习命令">
          <div className="section-title">
            <h2>用命令读取信息</h2>
            <span className="metadata">
              {progress.commands.length} / {lesson.commands.length} 条完成
            </span>
          </div>
          <div className="command-list">
            {lesson.commands.map((item, position) => (
              <div className="command-item" key={item.command}>
                <span className="command-number">
                  {progress.records.some(
                    (record) =>
                      record.command === normalizeCommand(item.command) &&
                      record.ok,
                  ) ? (
                    <Check />
                  ) : (
                    position + 1
                  )}
                </span>
                <div>
                  <strong>{item.purpose}</strong>
                  <code>{item.command}</code>
                  <p>{item.expected}</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => run(item.command)}
                  aria-label={`模拟运行：${item.command}`}
                  title="运行教学模拟"
                >
                  <Play />
                  <span>模拟运行</span>
                </button>
              </div>
            ))}
          </div>
          <section className="terminal" aria-label="教学模拟终端">
            <div className="terminal-heading">
              <h2>
                <Terminal />
                教学模拟终端
              </h2>
              <span>仅模拟，不执行本机命令</span>
            </div>
            <div
              className="terminal-output"
              tabIndex={0}
              aria-label="本课命令输出"
            >
              {displayRecords.length ? (
                displayRecords.map((record, position) => (
                  <div key={`${position}-${record.command}`}>
                    <div className="terminal-command">$ {record.command}</div>
                    <pre>{record.output}</pre>
                  </div>
                ))
              ) : (
                <p>运行上方命令，或输入本课命令查看样例。</p>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                run(input);
              }}
            >
              <span aria-hidden="true">$</span>
              <input
                aria-label="输入本课模拟命令"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入命令，或输入 help"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className="icon-button"
                aria-label="运行输入的模拟命令"
                title="运行模拟"
              >
                <Play />
              </button>
            </form>
          </section>
          {feedback && (
            <p className="inline-feedback" role="status">
              {feedback}
            </p>
          )}
          <div className="step-footer">
            <button className="text-button" onClick={() => onStep(0)}>
              <ArrowLeft />
              返回概念
            </button>
            <button className="primary-button" onClick={verify}>
              检查本课记录
              <ArrowRight />
            </button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="lesson-content" aria-label="判断证据">
          <div className="section-title">
            <h2>读懂结果，再做判断</h2>
            <span className={`badge ${progress.verified ? "good" : "sample"}`}>
              {progress.verified ? "模拟记录已验证" : "模拟记录待验证"}
            </span>
          </div>
          {lesson.quiz.evidence && (
            <pre className="evidence-output" aria-label="判断题证据">
              {lesson.quiz.evidence}
            </pre>
          )}
          <fieldset className="quiz">
            <legend>{lesson.quiz.question}</legend>
            {lesson.quiz.options.map((option, position) => (
              <label
                key={option}
                className={selectedAnswer === position ? "selected" : ""}
              >
                <input
                  type="radio"
                  name={`quiz-${lesson.id}`}
                  checked={selectedAnswer === position}
                  disabled={progress.quiz}
                  onChange={() => {
                    setAnswer(position);
                    setChecked(false);
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
          {!progress.quiz && (
            <button
              className="secondary-button"
              disabled={answer === null}
              onClick={() => {
                setChecked(true);
                if (answer === lesson.quiz.correct) onUpdate({ quiz: true });
              }}
            >
              检查答案
            </button>
          )}
          {(checked || progress.quiz) && (
            <div
              className={`answer-feedback ${progress.quiz ? "correct" : ""}`}
              role="status"
            >
              <strong>{progress.quiz ? "判断正确" : "再看一遍证据"}</strong>
              <p>{lesson.quiz.explanation}</p>
            </div>
          )}
          {!progress.concept && (
            <p className="inline-feedback">完成概念阅读后，才能完成本课。</p>
          )}
          {!progress.verified && (
            <p className="inline-feedback">
              请回到练习命令，检查本课模拟记录。
            </p>
          )}
          <div className="step-footer">
            <button className="text-button" onClick={() => onStep(1)}>
              <RotateCcw />
              返回命令
            </button>
            <button
              className="primary-button"
              disabled={!canCompleteLesson(lesson, progress)}
              onClick={onComplete}
            >
              完成本课
              <Check />
            </button>
          </div>
        </section>
      )}
    </>
  );
}
