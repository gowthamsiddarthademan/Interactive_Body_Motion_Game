let video;
let poseNet;
let poses = [];
let circles = [];
let score = 0;
let timeLeft = 60;
let gameOver = false;
let gameInterval, timerInterval;
let isCalibrated = false; // Track whether the player has been calibrated
let calibrationComplete = false; // Track if calibration is complete

const CIRCLE_COUNT = 5;
const CIRCLE_RADIUS = 20; // Reduced size for circles
const HAND_DETECTION_RADIUS = 50; // Detection radius around the wrists

// Set up canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Adjust canvas size
canvas.width = 640;
canvas.height = 480;

async function setupCamera() {
    video = document.createElement('video');
    video.width = 640;
    video.height = 480;
    video.autoplay = true;
    video.playsInline = true; // Important for mobile devices
    video.muted = true; // Mute to avoid sound issues

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                console.log('Video metadata loaded, starting video...');
                resolve(video);
            };
        });
    } catch (err) {
        console.error("Camera access error:", err);
        alert("Unable to access camera. Please ensure the camera is not blocked.");
    }
}

function setupPoseNet() {
    poseNet = ml5.poseNet(video, () => console.log('PoseNet model loaded'));
    poseNet.on('pose', (results) => poses = results);
}

function createRandomCircles() {
    circles = [];
    for (let i = 0; i < CIRCLE_COUNT; i++) {
        const circle = {
            x: Math.random() * (canvas.width - 2 * CIRCLE_RADIUS) + CIRCLE_RADIUS,
            y: Math.random() * (canvas.height - 2 * CIRCLE_RADIUS) + CIRCLE_RADIUS,
            radius: CIRCLE_RADIUS
        };
        circles.push(circle);
    }
}

function checkForTouches() {
    if (poses.length > 0) {
        const pose = poses[0].pose;

        // Check wrist positions (left and right)
        ['leftWrist', 'rightWrist'].forEach(part => {
            const keypoint = pose.keypoints.find(p => p.part === part);
            if (keypoint && keypoint.score > 0.5) {
                const wristX = canvas.width - keypoint.position.x; // Inverted X-axis (due to mirroring)
                const wristY = keypoint.position.y;

                circles.forEach((circle, index) => {
                    const dist = Math.sqrt((wristX - circle.x) ** 2 + (wristY - circle.y) ** 2);
                    if (dist < HAND_DETECTION_RADIUS) { // Use wrist for detection
                        circles.splice(index, 1); // Remove touched circle
                        score++;
                        document.getElementById('scoreboard').textContent = `Score: ${score}`;

                        // Immediately reload circles after touching one
                        if (circles.length === 0) {
                            createRandomCircles(); // Reload circles
                        }
                    }
                });
            }
        });
    }
}

function drawCircles() {
    circles.forEach(circle => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'blue'; // Circle color
        ctx.fill();
        ctx.closePath();
    });
}

function drawBodyOutline() {
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 4;

    // Draw the outline for the human body shape
    ctx.beginPath();

    // Head
    ctx.arc(320, 90, 20, 0, 2 * Math.PI); // Head at (320, 90)

    // Neck
    ctx.moveTo(320, 110);
    ctx.lineTo(320, 140); // Neck

    // Shoulders
    ctx.lineTo(280, 160); // Left shoulder
    ctx.moveTo(320, 140);
    ctx.lineTo(360, 160); // Right shoulder

    // Arms
    ctx.moveTo(280, 160);
    ctx.lineTo(240, 200); // Left arm
    ctx.moveTo(360, 160);
    ctx.lineTo(400, 200); // Right arm

    // Body
    ctx.moveTo(320, 140);
    ctx.lineTo(320, 300); // Body down to hips

    // Hips
    ctx.moveTo(320, 300);
    ctx.lineTo(280, 340); // Left hip
    ctx.moveTo(320, 300);
    ctx.lineTo(360, 340); // Right hip

    ctx.stroke();
}

function calibratePlayerPosition() {
    if (poses.length > 0) {
        const pose = poses[0].pose;
        const nose = pose.keypoints.find(p => p.part === 'nose');
        const leftShoulder = pose.keypoints.find(p => p.part === 'leftShoulder');
        const rightShoulder = pose.keypoints.find(p => p.part === 'rightShoulder');

        // Check if the user is within the calibration outline
        if (nose && nose.score > 0.5 && leftShoulder && leftShoulder.score > 0.5 && rightShoulder && rightShoulder.score > 0.5) {
            const noseX = nose.position.x;
            const noseY = nose.position.y;

            // Assuming user needs to stand within certain range
            if (noseX > 220 && noseX < 420 && noseY > 100 && noseY < 400) {
                isCalibrated = true; // Calibration successful
                calibrationComplete = true; // Mark calibration as complete
                document.getElementById('calibrationMessage').style.display = 'none'; // Hide calibration message
                startGame(); // Start the game once calibration is successful
            }
        }
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Check if video is ready and draw it onto the canvas
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Flip the canvas horizontally for the mirrored effect
        ctx.save();
        ctx.scale(-1, 1); // Flip horizontally
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
    } else {
        console.log("Waiting for video to be ready...");
    }

    // Draw the calibration outline if not calibrated
    if (!calibrationComplete) {
        drawBodyOutline();
        calibratePlayerPosition();
    } else {
        checkForTouches();
        drawCircles();
    }

    if (!gameOver) requestAnimationFrame(gameLoop);
}

function startGame() {
    createRandomCircles();
    gameLoop();
    score = 0;
    timeLeft = 60;
    gameOver = false;
    document.getElementById('scoreboard').textContent = `Score: ${score}`;
    document.getElementById('timer').textContent = `Time: ${timeLeft}`;
    document.getElementById('playAgain').style.display = 'none'; // Hide play again button

    gameInterval = setInterval(() => {
        if (circles.length === 0) createRandomCircles();
    }, 5000);

    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').textContent = `Time: ${timeLeft}`;
        if (timeLeft === 0) endGame();
    }, 1000);
}

function endGame() {
    gameOver = true;
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    document.getElementById('playAgain').style.display = 'block'; // Show play again button
    alert(`Game Over! Your score: ${score}`);
}

async function init() {
    await setupCamera();
    setupPoseNet();
    gameLoop();
}

document.getElementById('playAgain').addEventListener('click', () => {
    isCalibrated = false; // Reset calibration
    calibrationComplete = false; // Reset calibration complete flag
    document.getElementById('calibrationMessage').style.display = 'block'; // Show calibration message
    startGame();
});

init();
