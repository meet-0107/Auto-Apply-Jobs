/* feedback.js - Draggable Logic */

function initFeedbackWidget() {
    const feedback = document.getElementById('feedback-widget');
    if (!feedback) return;

    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Load saved position if exists
    const savedPos = localStorage.getItem('feedback_position');
    if (savedPos) {
        const { x, y } = JSON.parse(savedPos);
        xOffset = x;
        yOffset = y;
        setTranslate(x, y, feedback);
    }

    feedback.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    // Touch support
    feedback.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);

    function dragStart(e) {
        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }

        if (e.target === feedback || feedback.contains(e.target)) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();

            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, feedback);
        }
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        
        // Save position
        localStorage.setItem('feedback_position', JSON.stringify({ x: xOffset, y: yOffset }));
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
}

// Initial call
document.addEventListener('DOMContentLoaded', initFeedbackWidget);
window.initFeedbackWidget = initFeedbackWidget;
