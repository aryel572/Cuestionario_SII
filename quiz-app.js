(function () {
  "use strict";

  const STORAGE_PREFIX = "sii-cuestionario:v1:";
  const LETTERS = ["A", "B", "C", "D"];

  function keyFor(quizId) {
    return `${STORAGE_PREFIX}${quizId}`;
  }

  function blankState() {
    return { current: 0, answers: {} };
  }

  function loadState(quiz) {
    try {
      const raw = localStorage.getItem(keyFor(quiz.id));
      if (!raw) return blankState();
      const stored = JSON.parse(raw);
      const state = blankState();
      const candidateAnswers = stored && typeof stored.answers === "object" ? stored.answers : {};

      Object.entries(candidateAnswers).forEach(([questionIndex, answerIndex]) => {
        const q = quiz.questions[Number(questionIndex)];
        if (q && Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < q.options.length) {
          state.answers[questionIndex] = answerIndex;
        }
      });

      if (Number.isInteger(stored.current) && stored.current >= 0 && stored.current < quiz.questions.length) {
        state.current = stored.current;
      }
      return state;
    } catch (_) {
      return blankState();
    }
  }

  function saveState(quizId, state) {
    try {
      localStorage.setItem(keyFor(quizId), JSON.stringify(state));
    } catch (_) {
      // La práctica sigue funcionando en memoria si el navegador bloquea el almacenamiento.
    }
  }

  function clearState(quizId) {
    try {
      localStorage.removeItem(keyFor(quizId));
    } catch (_) {
      // No se impide el reinicio visual si el navegador bloquea el almacenamiento.
    }
  }

  function answeredCount(state) {
    return Object.keys(state.answers).length;
  }

  function score(quiz, state) {
    return quiz.questions.reduce((total, question, index) => total + (state.answers[index] === question.answer ? 1 : 0), 0);
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function getData() {
    return window.QUIZ_DATA || {};
  }

  function updateLanding() {
    const data = getData();
    document.querySelectorAll("[data-quiz-card]").forEach((card) => {
      const quiz = data[card.dataset.quizCard];
      if (!quiz) return;
      const state = loadState(quiz);
      const totalAnswered = answeredCount(state);
      const completed = totalAnswered === quiz.questions.length;
      const status = card.querySelector("[data-card-status]");
      if (status) {
        const result = completed ? ` · ${score(quiz, state)}/${quiz.questions.length} correctas` : "";
        status.textContent = `${totalAnswered}/${quiz.questions.length} respondidas${result}`;
      }
    });
  }

  function renderQuiz(root, quiz, state) {
    const question = quiz.questions[state.current];
    const totalAnswered = answeredCount(state);
    const currentAnswer = state.answers[state.current];
    const currentIsAnswered = Number.isInteger(currentAnswer);
    const currentIsCorrect = currentAnswer === question.answer;
    const totalScore = score(quiz, state);
    const isComplete = totalAnswered === quiz.questions.length;

    document.title = `${quiz.title} | Cuestionario`;
    root.replaceChildren();

    const shell = make("section", "quiz-shell");
    shell.setAttribute("aria-label", quiz.title);

    const topbar = make("div", "quiz-topbar");
    const titleGroup = document.createElement("div");
    titleGroup.append(make("h1", "quiz-topbar__title", quiz.title), make("p", "quiz-topbar__source", quiz.subtitle));
    const backLink = make("a", "back-link", "← Volver a cuestionarios");
    backLink.href = "Index.html";
    topbar.append(titleGroup, backLink);

    const status = make("div", "quiz-status");
    const progressBox = make("div", "status-item");
    progressBox.append(make("span", "", "Avance"), make("strong", "", `${totalAnswered} de ${quiz.questions.length} respondidas`));
    const scoreBox = make("div", "status-item");
    scoreBox.append(make("span", "", "Aciertos actuales"), make("strong", "", `${totalScore} de ${quiz.questions.length}`));
    status.append(progressBox, scoreBox);

    const questionNav = make("nav", "question-nav");
    questionNav.setAttribute("aria-label", "Ir a una pregunta");
    quiz.questions.forEach((_, index) => {
      const navButton = make("button", "question-nav__button", String(index + 1));
      navButton.type = "button";
      navButton.title = `Ir a la pregunta ${index + 1}`;
      navButton.setAttribute("aria-label", `Ir a la pregunta ${index + 1}`);
      if (index === state.current) navButton.classList.add("is-current");
      if (Object.prototype.hasOwnProperty.call(state.answers, index)) navButton.classList.add("is-answered");
      navButton.addEventListener("click", () => {
        state.current = index;
        saveState(quiz.id, state);
        renderQuiz(root, quiz, state);
      });
      questionNav.append(navButton);
    });

    const content = make("section", "question-content");
    content.append(make("p", "question-kicker", `Pregunta ${state.current + 1} de ${quiz.questions.length}`));
    content.append(make("h2", "question-prompt", question.prompt));

    const fieldset = document.createElement("fieldset");
    fieldset.append(make("legend", "", "Selecciona una alternativa"));
    const options = make("div", "options");
    question.options.forEach((optionText, optionIndex) => {
      const option = make("button", "option");
      option.type = "button";
      option.setAttribute("aria-pressed", String(currentAnswer === optionIndex));
      const letter = make("span", "option__letter", question.type === "tf" ? optionText.charAt(0) : LETTERS[optionIndex]);
      const label = make("span", "", optionText);
      option.append(letter, label);
      if (currentAnswer === optionIndex) option.classList.add("is-selected");
      if (currentIsAnswered && optionIndex === question.answer) option.classList.add("is-correct");
      if (currentIsAnswered && currentAnswer === optionIndex && !currentIsCorrect) option.classList.add("is-wrong");
      option.addEventListener("click", () => {
        state.answers[state.current] = optionIndex;
        saveState(quiz.id, state);
        renderQuiz(root, quiz, state);
      });
      options.append(option);
    });
    fieldset.append(options);
    content.append(fieldset);

    if (currentIsAnswered) {
      const feedback = make("aside", `feedback ${currentIsCorrect ? "is-correct" : "is-wrong"}`);
      feedback.setAttribute("aria-live", "polite");
      feedback.append(make("h3", "", currentIsCorrect ? "✓ Respuesta correcta" : "✕ Aún no es correcta"));
      const correctText = question.options[question.answer];
      feedback.append(make("p", "", `La respuesta correcta es: ${correctText}. ${question.explanation}`));
      content.append(feedback);
    }

    const actions = make("div", "quiz-actions");
    const reset = make("button", "button button--danger", "Reiniciar este cuestionario");
    reset.type = "button";
    reset.addEventListener("click", () => {
      if (window.confirm("Se borrarán únicamente las respuestas y el avance de este cuestionario. ¿Deseas continuar?")) {
        clearState(quiz.id);
        renderQuiz(root, quiz, blankState());
      }
    });
    const navigation = make("div", "quiz-actions__group");
    const previous = make("button", "button button--secondary", "← Anterior");
    previous.type = "button";
    previous.disabled = state.current === 0;
    previous.addEventListener("click", () => {
      state.current -= 1;
      saveState(quiz.id, state);
      renderQuiz(root, quiz, state);
    });
    const next = make("button", "button", "Siguiente →");
    next.type = "button";
    next.disabled = state.current === quiz.questions.length - 1;
    next.addEventListener("click", () => {
      state.current += 1;
      saveState(quiz.id, state);
      renderQuiz(root, quiz, state);
    });
    navigation.append(previous, next);
    actions.append(reset, navigation);

    shell.append(topbar, status, questionNav, content, actions);
    root.append(shell);

    if (isComplete) {
      const summary = make("section", "summary-card is-complete");
      summary.setAttribute("aria-live", "polite");
      summary.append(make("h2", "", "Cuestionario completado"));
      summary.append(make("p", "", `Resultado actual: ${totalScore} de ${quiz.questions.length} respuestas correctas.`));
      summary.append(make("p", "", "Puedes revisar cualquier pregunta desde los botones numerados o modificar una respuesta si quieres seguir practicando."));
      root.append(summary);
    }
  }

  function startQuiz(root) {
    const quiz = getData()[root.dataset.quizId];
    if (!quiz) {
      root.textContent = "No se pudo cargar el cuestionario.";
      return;
    }
    renderQuiz(root, quiz, loadState(quiz));
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("landing")) {
      updateLanding();
      window.addEventListener("focus", updateLanding);
      window.addEventListener("pageshow", updateLanding);
      window.addEventListener("storage", (event) => {
        if (!event.key || event.key.startsWith(STORAGE_PREFIX)) updateLanding();
      });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) updateLanding();
      });
    }
    const quizRoot = document.getElementById("quiz-app");
    if (quizRoot) startQuiz(quizRoot);
  });
}());
