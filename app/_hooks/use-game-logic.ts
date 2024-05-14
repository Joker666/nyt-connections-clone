import { useEffect, useMemo, useRef, useState } from "react";
import { categories as localCategories } from "../_examples";
import { Category, SubmitResult, Word } from "../_types";
import { delay, shuffleArray } from "../_utils";

export default function useGameLogic() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [gameWords, setGameWords] = useState<Word[]>([]);
  const selectedWords = useMemo(
    () => gameWords.filter((item) => item.selected),
    [gameWords]
  );
  const [clearedCategories, setClearedCategories] = useState<Category[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [isLost, setIsLost] = useState(false);
  const [mistakesRemaining, setMistakesRemaning] = useState(4);
  const guessHistoryRef = useRef<Word[][]>([]);

  useEffect(() => {
    getLocalCategories().then((categories) => {
      setCategories(categories);

      const words: Word[] = categories
        .map((category) =>
          category.words.map((word) => ({ word: word, level: category.level }))
        )
        .flat();
      setGameWords(shuffleArray(words));
    });
  }, []);

  const getLocalCategories = (): Promise<Category[]> => {
    const promise: Promise<Category[]> = new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(localCategories);
      }, 300);
    });

    return promise;
  };

  const getAICategories = (): Promise<Category[]> => {
    return fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "Always answer in JSON format only. Skip any text before the JSON, like sure here are more patterns.",
          },
          {
            role: "user",
            content:
              'Below, each JSON line has a pattern that the 4 words follow:\n\n[{"pattern":"Animal Groups","words":["colony","herd","pride","school"],"level":1},{"pattern":"Small Opening","words":["cranny","niche","nook","recess"],"level":2},{"pattern":"Paradigmatic","words":["classic","definitive","model","textbook"],"level":3},{"pattern":"Rhyming Compound Words","words":["backpack","bigwig","downtown","ragtag"],"level":4},{"pattern":"Cell Phone Modes","words":["focus","ring","silent","vibrate"],"level":5},{"pattern":"Romantic Beginnings","words":["connection","feelings","spark","vibe"],"level":6}]\n\nGenerate 4 more patterns and their associated 4 words similar to the above examples in JSON format. Do not reuse any of the examples. Only generate 4 patterns. Only return the examples in JSON format. Do not return anything besides the examples.',
          },
        ],
        temperature: 0.7,
        max_tokens: -1,
        stream: false,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        const choice = data.choices[0];
        const content = choice.message.content;
        console.log(content);
        const categories: Category[] = JSON.parse(content);
        console.log(categories);
        return categories;
      });
  };

  const selectWord = (word: Word): void => {
    const newGameWords = gameWords.map((item) => {
      // Only allow word to be selected if there are less than 4 selected words
      if (word.word === item.word) {
        return {
          ...item,
          selected: selectedWords.length < 4 ? !item.selected : false,
        };
      } else {
        return item;
      }
    });

    setGameWords(newGameWords);
  };

  const shuffleWords = () => {
    setGameWords([...shuffleArray(gameWords)]);
  };

  const deselectAllWords = () => {
    setGameWords(
      gameWords.map((item) => {
        return { ...item, selected: false };
      })
    );
  };

  const getSubmitResult = (): SubmitResult => {
    const sameGuess = guessHistoryRef.current.some((guess) =>
      guess.every((word) => selectedWords.includes(word))
    );

    if (sameGuess) {
      console.log("Same!");
      return { result: "same" };
    }

    guessHistoryRef.current.push(selectedWords);

    const likenessCounts = categories.map((category) => {
      return selectedWords.filter((item) => category.words.includes(item.word))
        .length;
    });

    const maxLikeness = Math.max(...likenessCounts);
    const maxIndex = likenessCounts.indexOf(maxLikeness);

    if (maxLikeness === 4) {
      return getCorrectResult(categories[maxIndex]);
    } else {
      return getIncorrectResult(maxLikeness);
    }
  };

  const getCorrectResult = (category: Category): SubmitResult => {
    setClearedCategories([...clearedCategories, category]);
    setGameWords(
      gameWords.filter((item) => !category.words.includes(item.word))
    );

    if (clearedCategories.length === 3) {
      return { result: "win" };
    } else {
      return { result: "correct" };
    }
  };

  const getIncorrectResult = (maxLikeness: number): SubmitResult => {
    setMistakesRemaning(mistakesRemaining - 1);

    if (mistakesRemaining === 1) {
      return { result: "loss" };
    } else if (maxLikeness === 3) {
      return { result: "one-away" };
    } else {
      return { result: "incorrect" };
    }
  };

  const handleLoss = async () => {
    const remainingCategories = categories.filter(
      (category) => !clearedCategories.includes(category)
    );

    deselectAllWords();

    for (const category of remainingCategories) {
      await delay(1000);
      setClearedCategories((prevClearedCategories) => [
        ...prevClearedCategories,
        category,
      ]);
      setGameWords((prevGameWords) =>
        prevGameWords.filter((item) => !category.words.includes(item.word))
      );
    }

    await delay(1000);
    setIsLost(true);
  };

  const handleWin = async () => {
    await delay(1000);
    setIsWon(true);
  };

  return {
    gameWords,
    selectedWords,
    clearedCategories,
    mistakesRemaining,
    isWon,
    isLost,
    guessHistoryRef,
    selectWord,
    shuffleWords,
    deselectAllWords,
    getSubmitResult,
    handleLoss,
    handleWin,
  };
}
