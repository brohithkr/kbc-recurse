/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import SemiCircleProgressBar from "react-progressbar-semicircle";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./screens/Logo";
import { fadeInVariants, logoVariants, optionItemVariants, optionsContainerVariants, optionTextVariants, questionVariants, textChangeVariants, timerVariants } from "@/constants/animations";
import Question from "./screens/Question";
import Lifeline from "./screens/Lifeline";
import Status from "./screens/Status";

const audioFiles = {
    correct: "/audio/Correct.mp3",
    wrong: "/audio/Wrong.mp3",
    timer: "/audio/Timer.mp3",
    intro: "/audio/Intro.mp3",
    end: "/audio/End.mp3",
    lock: "/audio/Lock.mp3",
    next: "/audio/Next Question.mp3",
    suspense1: "/audio/Suspense 1.mp3",
    suspense2: "/audio/Suspense 2.mp3",
    suspense3: "/audio/Suspense 3.mp3",
    suspense4: "/audio/Suspense 4.mp3",
};
const icons = {
    '50-50': '/50-50.png',
    'Audience Poll': '/Audience Poll.png',
    'Phone a friend': '/Phone a friend.png',
};

export default function DisplayPage() {
    const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000", {
        extraHeaders: {
            'ngrok-skip-browser-warning': 'true'
        }
    });
    
    const [question, setQuestion] = useState({
        text: "",
        options: ["&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
        correctIndex: null,
        wrongIndex: null,
        selected: null,
        timer: 60,
        maxTimer: 60,
        showOptions: false
    });
    const [selectedStatus, setSelectedStatus] = useState({ index: null, status: "" });
    const [correctAnswer, setCorrectAnswer] = useState(null);
    const [timer, setTimer] = useState({ current: 0, max: 0 });
    const [timerFrozen, setTimerFrozen] = useState(true);
    const [showOptions, setShowOptions] = useState(false);
    const [currentScreen, setCurrentScreen] = useState("logo");
    const audioRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const lastUpdateTime = useRef(0);

    const [lifelineStatus, setLifelineStatus] = useState({
        "50-50": false,
        "Audience Poll": false,
        "Phone a friend": false
    });
    const [hiddenOptions, setHiddenOptions] = useState([]);
    const [specificLifeline, setSpecificLifeline] = useState(null);
    const [questionNumber, setQuestionNumber] = useState(1);

    useEffect(() => {
        socket.on("display-question", (data) => {
            setQuestion(data);
            setSelectedStatus({ index: null, status: "" });
            setCorrectAnswer(null);
            setTimer({ current: data.timer || 60, max: data.maxTimer || 60 });
            setShowOptions(data.showOptions || false);
            setTimerFrozen(true);
        });

        socket.on("show-options", () => {
            setShowOptions(true);
            setTimerFrozen(false);
        });

        socket.on("highlight-answer", (index) => {
            setSelectedStatus({ index, status: "selected" });
            setCorrectAnswer(null);
        });

        socket.on("mark-correct", (index) => {
            setSelectedStatus({ index, status: "correct" });
            setCorrectAnswer(null);
            playAudio("correct");
        });

        socket.on("mark-wrong", (index) => {
            setSelectedStatus({ index, status: "wrong" });
            setCorrectAnswer(null);
            playAudio("wrong");
        });

        socket.on("show-correct-answer", (data) => {
            setSelectedStatus({ index: data.selectedIndex, status: "selected" });
            setCorrectAnswer(data.correctIndex);
            playAudio("wrong");
        });

        socket.on("reset-highlights", () => {
            setSelectedStatus({ index: null, status: "" });
            setCorrectAnswer(null);
        });

        socket.on("update-timer", (data) => {
            setTimer({
                current: data.current,
                max: data.max
            });

            lastUpdateTime.current = Date.now();

            if (data.audioTrigger && data.current !== "unlimited") {
                const audioLength = 60;
                let startPosition = 0;

                if (data.startPosition !== undefined) {
                    startPosition = data.startPosition;
                } else if (typeof data.current === 'number') {
                    startPosition = Math.max(0, audioLength - data.current);
                }

                playAudio("timer", startPosition);
            } else if (data.current === "unlimited") {
                stopAllAudio();
            }
        });

        socket.on("clear-question", () => {
            setQuestion({
                text: "",
                options: ["&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
                correctIndex: null,
                wrongIndex: null,
                selected: null,
                timer: 60,
                maxTimer: 60,
                showOptions: false
            });
            setHiddenOptions([]);
            setSpecificLifeline(null);
            stopAllAudio();
            setTimerFrozen(true);
            setShowOptions(false);
            setSelectedStatus({ index: null, status: "" });
            setCorrectAnswer(null);
        });

        socket.on("trigger-audio", (audioKey) => {
            if (audioKey === "stop") {
                stopAllAudio();
                return;
            }
            playAudio(audioKey);
        });

        socket.on("freeze-timer", (triggerAudio) => {
            setTimerFrozen(true);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }

            if (triggerAudio) {
                stopAllAudio();
            }
        });

        socket.on("unfreeze-timer", (triggerAudio, audioOffset) => {
            setTimerFrozen(false);

            if (triggerAudio) {
                const offset = audioOffset || (typeof timer.current === 'number' ? 60 - timer.current : 0);
                playAudio("timer", offset);
            }
        });

        socket.on("change-screen", (screen) => {
            setCurrentScreen(screen);
        });

        socket.on("update-lifelines", (status) => {
            setLifelineStatus(status);
        });

        socket.on("apply-5050", (optionsToHide) => {
            setHiddenOptions(optionsToHide);
        });

        socket.on("show-specific-lifeline", (lifeline) => {
            setSpecificLifeline(lifeline);
        });

        socket.on("update-question-number", (data) => {
            setQuestionNumber(data.questionNumber);
        });

        return () => {
            socket.off("display-question");
            socket.off("show-options");
            socket.off("highlight-answer");
            socket.off("mark-correct");
            socket.off("mark-wrong");
            socket.off("update-timer");
            socket.off("clear-question");
            socket.off("trigger-audio");
            socket.off("freeze-timer");
            socket.off("unfreeze-timer");
            socket.off("change-screen");
            socket.off("show-correct-answer");
            socket.off("reset-highlights");
            socket.off("update-lifelines");
            socket.off("apply-5050");
            socket.off("show-specific-lifeline");
            socket.off("update-question-number");
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (timer.current === "unlimited" || timerFrozen) {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            return;
        }

        if (timer.current > 0 && !timerFrozen) {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }

            timerIntervalRef.current = setInterval(() => {
                const now = Date.now();
                const elapsedSinceLastUpdate = (now - lastUpdateTime.current) / 1000;

                if (elapsedSinceLastUpdate >= 0.9) {
                    setTimer(prev => {
                        if (typeof prev.current === 'number' && prev.current > 0) {
                            lastUpdateTime.current = now;
                            return { ...prev, current: prev.current - 1 };
                        }
                        return prev;
                    });
                }
            }, 1000);

            return () => {
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
            };
        }
    }, [timer.current, timerFrozen]);

    const stopAllAudio = async () => {
        if (audioRef.current) {
            await audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
    };

    const playAudio = async (key, offset = 0) => {
        try {
            await stopAllAudio();
            console.log(`Playing ${key} with offset ${offset}`);
            if (audioFiles[key]) {
                audioRef.current = new Audio(audioFiles[key]);
                if (offset > 0) {
                    audioRef.current.currentTime = offset;
                }
                await audioRef.current.play();
            }
        }
        catch (e) {
            console.log(e);
        }
    };

    const getBgColor = (index) => {
        if (correctAnswer !== null && selectedStatus.index !== null) {
            if (index === correctAnswer) {
                return "bg-gradient-to-r from-green-800 via-green-700 to-green-800";
            }
            if (index === selectedStatus.index) {
                return "bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700";
            }
        }

        if (selectedStatus.index === index) {
            if (selectedStatus.status === "selected") return "bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700";
            if (selectedStatus.status === "correct") return "bg-gradient-to-r from-green-800 via-green-700 to-green-800";
            if (selectedStatus.status === "wrong") return "bg-gradient-to-r from-red-800 via-red-700 to-red-800";
        }
        return "bg-gradient-to-r from-[#03126F] via-[#053EAE] to-[#03126F]";
    };

    useEffect(() => {
        setSpecificLifeline(null);
    }, [currentScreen]);

    const prizeAmounts = ["₹500", "₹400", "₹300", "₹200", "₹100", "₹50", "₹0", "₹0", "₹0", "₹0", "₹0"];

    const renderScreen = () => {
        switch (currentScreen) {
            case "logo":
                return <Logo />
            case "question":
                return <Question question={question} questionNumber={questionNumber} timer={timer} hiddenOptions={hiddenOptions} showOptions={showOptions} getBgColor={getBgColor} />
            case "lifeline":
                return <Lifeline icons={icons} lifelineStatus={lifelineStatus} specificLifeline={specificLifeline} />
            case "status":
                return <Status prizeAmounts={prizeAmounts} questionNumber={questionNumber} />
            case "blank":
                return <div className="w-full h-screen bg-black" />
            default:
                return <Logo />
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-black text-white">
            <div className="w-full text-center">
                <div className="mx-auto">
                    {renderScreen()}
                </div>
            </div>
        </div>
    );
}
