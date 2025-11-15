(function () {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const startScreen = document.getElementById("start-screen");
  const startButton = document.getElementById("start-button");
  const scoreDisplay = document.getElementById("score-display");
  const feedback = document.getElementById("feedback");
  const plusOne = document.getElementById("plus-one");
  const messageOverlay = document.getElementById("message");
  const messageText = document.getElementById("message-text");

  const DPR = window.devicePixelRatio || 1;

  const images = {
    background: loadImage("belga_hunt_assets/background.png"),
    dogNeutral: loadImage("belga_hunt_assets/dog_neutral.png"),
    dogPointing: loadImage("belga_hunt_assets/dog_pointing.png"),
    turkey: loadImage("belga_hunt_assets/turkey.png"),
  };

  let lastTime = 0;
  let gameRunning = false;
  let gameFinished = false;
  let score = 0;

  // Pointer state
  let pointer = {
    x: null,
    y: null,
    active: false,
  };

  // Dog state
  const dog = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    pawX: 0,
    pawY: 0,
  };

  // Turkey state
  const turkey = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    speed: 0,
    alive: false,
    dir: 1,
    respawnTimer: 0,
  };

  let feedbackTimer = 0;
  let plusOneTimer = 0;

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * DPR;
    canvas.height = rect.height * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layoutScene();
  }

  function layoutScene() {
    const w = canvas.clientWidth || canvas.width / DPR;
    const h = canvas.clientHeight || canvas.height / DPR;

    // Dog size relative to canvas
    dog.height = h * 0.45;
    const dogAspect = images.dogNeutral.width / images.dogNeutral.height || 1.5;
    dog.width = dog.height * dogAspect;

    dog.x = w * 0.08;
    const groundY = h * 0.85;
    dog.y = groundY - dog.height;

    // Approximate paw position on the pointing sprite (relative ratios)
    dog.pawX = dog.x + dog.width * 0.72;
    dog.pawY = dog.y + dog.height * 0.58;

    // Turkey size
    const tAspect = images.turkey.width / images.turkey.height || 1;
    turkey.height = h * 0.20;
    turkey.width = turkey.height * tAspect;

    if (!turkey.alive && !gameFinished) {
      scheduleTurkeySpawn(0.5);
    }
  }

  function scheduleTurkeySpawn(delaySeconds) {
    turkey.alive = false;
    turkey.respawnTimer = delaySeconds;
  }

  function spawnTurkey() {
    const w = canvas.clientWidth || canvas.width / DPR;
    const h = canvas.clientHeight || canvas.height / DPR;

    const minY = h * 0.55;
    const maxY = h * 0.8;
    turkey.y = minY + Math.random() * (maxY - minY) - turkey.height / 2;

    // Spawn to the right of the dog, moving horizontally
    turkey.dir = Math.random() < 0.5 ? 1 : -1;
    const margin = 30;
    const spawnLeft = dog.x + dog.width + margin;
    const spawnRight = w - margin - turkey.width;

    if (turkey.dir === 1) {
      turkey.x = spawnLeft;
    } else {
      turkey.x = spawnRight;
    }

    turkey.speed = 80 + Math.random() * 80; // pixels per second
    turkey.alive = true;
  }

  function update(dt) {
    if (!gameRunning) return;

    if (turkey.respawnTimer > 0) {
      turkey.respawnTimer -= dt;
      if (turkey.respawnTimer <= 0 && !gameFinished) {
        spawnTurkey();
      }
    }

    if (turkey.alive) {
      turkey.x += turkey.speed * turkey.dir * dt;

      const w = canvas.clientWidth || canvas.width / DPR;
      if (turkey.dir === 1 && turkey.x > w + turkey.width) {
        scheduleTurkeySpawn(0.8);
      } else if (turkey.dir === -1 && turkey.x + turkey.width < -turkey.width) {
        scheduleTurkeySpawn(0.8);
      }
    }

    if (feedbackTimer > 0) {
      feedbackTimer -= dt;
      if (feedbackTimer <= 0) {
        feedback.classList.add("hidden");
      }
    }

    if (plusOneTimer > 0) {
      plusOneTimer -= dt;
      if (plusOneTimer <= 0) {
        plusOne.classList.add("hidden");
        plusOne.classList.remove("show");
      }
    }
  }

  function draw() {
    const w = canvas.clientWidth || canvas.width / DPR;
    const h = canvas.clientHeight || canvas.height / DPR;

    // Background
    if (images.background.complete) {
      const bgAspect = images.background.width / images.background.height;
      const canvasAspect = w / h;
      let drawW, drawH, offsetX, offsetY;
      if (canvasAspect > bgAspect) {
        drawW = w;
        drawH = w / bgAspect;
        offsetX = 0;
        offsetY = (h - drawH) / 2;
      } else {
        drawH = h;
        drawW = h * bgAspect;
        offsetX = (w - drawW) / 2;
        offsetY = 0;
      }
      ctx.drawImage(images.background, offsetX, offsetY, drawW, drawH);
    } else {
      ctx.fillStyle = "#224422";
      ctx.fillRect(0, 0, w, h);
    }

    // Draw turkey
    if (turkey.alive && images.turkey.complete) {
      ctx.drawImage(images.turkey, turkey.x, turkey.y, turkey.width, turkey.height);
    }

    // Draw dog
    const dogImg = shouldUsePointingDog() ? images.dogPointing : images.dogNeutral;
    if (dogImg.complete) {
      ctx.drawImage(dogImg, dog.x, dog.y, dog.width, dog.height);
    }

    // Draw aiming line
    if (shouldDrawArrow()) {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dog.pawX, dog.pawY);
      ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
    }
  }

  function shouldDrawArrow() {
    return (
      gameRunning &&
      pointer.active &&
      pointer.x != null &&
      pointer.y != null
    );
  }

  function shouldUsePointingDog() {
    return shouldDrawArrow();
  }

  function gameLoop(timestamp) {
    const t = timestamp / 1000;
    const dt = lastTime ? t - lastTime : 0;
    lastTime = t;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
  }

  function setScore(value) {
    score = value;
    scoreDisplay.textContent = "Score: " + score;
  }

  function registerHit() {
    if (!turkey.alive) return;
    turkey.alive = false;
    scheduleTurkeySpawn(0.8);

    // Big "GOOD GIRL BELGA!" text
    feedback.textContent = "GOOD GIRL BELGA!";
    feedback.classList.remove("hidden");
    feedbackTimer = 1.0;

    // Floating +1 arcade-style pop
    plusOne.classList.remove("hidden");
    plusOne.classList.remove("show");
    // Force reflow to restart animation
    void plusOne.offsetWidth;
    plusOne.classList.add("show");
    plusOneTimer = 0.7;

    setScore(score + 1);

    if (score >= 3 && !gameFinished) {
      gameFinished = true;
      messageText.textContent = "Dinner begins at 4:30! We can't wait to see you!";
      messageOverlay.classList.remove("hidden");
    }
  }

  function isPointerOnTurkey(x, y) {
    if (!turkey.alive) return false;
    return (
      x >= turkey.x &&
      x <= turkey.x + turkey.width &&
      y >= turkey.y &&
      y <= turkey.y + turkey.height
    );
  }

  function canvasPointFromEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (ev.touches && ev.touches.length) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else if (ev.changedTouches && ev.changedTouches.length) {
      clientX = ev.changedTouches[0].clientX;
      clientY = ev.changedTouches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function handlePointerDown(ev) {
    if (!gameRunning) return;
    ev.preventDefault();
    const p = canvasPointFromEvent(ev);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.active = true;

    if (isPointerOnTurkey(p.x, p.y)) {
      registerHit();
    }
  }

  function handlePointerMove(ev) {
    if (!gameRunning) return;
    const p = canvasPointFromEvent(ev);
    pointer.x = p.x;
    pointer.y = p.y;
  }

  function handlePointerUp(ev) {
    pointer.active = false;
  }

  function startGame() {
    startScreen.classList.add("hidden");
    gameRunning = true;
    lastTime = 0;
    pointer.active = false;
    setScore(0);
    gameFinished = false;
    messageOverlay.classList.add("hidden");
    scheduleTurkeySpawn(0.5);
  }

  window.addEventListener("resize", resizeCanvas);

  canvas.addEventListener("mousedown", handlePointerDown);
  canvas.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp);

  canvas.addEventListener("touchstart", handlePointerDown, { passive: false });
  canvas.addEventListener("touchmove", handlePointerMove, { passive: false });
  window.addEventListener("touchend", handlePointerUp);

  startButton.addEventListener("click", function () {
    startGame();
  });

  // Wait for images to load before first layout & loop
  Promise.all(
    Object.values(images).map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  ).then(() => {
    resizeCanvas();
    requestAnimationFrame(gameLoop);
  });
})();