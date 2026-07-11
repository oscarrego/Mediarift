import os
import sys
import ctypes
import logging
import threading

logger = logging.getLogger("mediarift.task_manager")

_tasks = {}
_lock = threading.Lock()

def register_task(task_id: str, process) -> None:
    if not task_id:
        return
    with _lock:
        _tasks[task_id] = {
            "process": process,
            "status": "running"
        }
    logger.info("TaskManager: registered task %s", task_id)

def unregister_task(task_id: str) -> None:
    with _lock:
        _tasks.pop(task_id, None)
    logger.debug("TaskManager: unregistered task %s", task_id)

def is_task_paused(task_id: str) -> bool:
    with _lock:
        task = _tasks.get(task_id)
        return task is not None and task["status"] == "paused"

def is_task_cancelled(task_id: str) -> bool:
    with _lock:
        task = _tasks.get(task_id)
        return task is None or task["status"] == "cancelled"

def get_task_status(task_id: str) -> str:
    with _lock:
        task = _tasks.get(task_id)
        return task["status"] if task else "running"

def suspend_task(task_id: str) -> bool:
    with _lock:
        task = _tasks.get(task_id)
        if not task or task["status"] != "running":
            return False
        
        process = task["process"]
        pid = process.pid
        logger.info("TaskManager: suspending task %s (PID %d)", task_id, pid)
        
        success = False
        if sys.platform == "win32":
            try:
                ntdll = ctypes.windll.ntdll
                kernel32 = ctypes.windll.kernel32
                PROCESS_SUSPEND_RESUME = 0x0800
                handle = kernel32.OpenProcess(PROCESS_SUSPEND_RESUME, False, pid)
                if handle:
                    ntdll.NtSuspendProcess(handle)
                    kernel32.CloseHandle(handle)
                    success = True
            except Exception as e:
                logger.error("Failed to suspend Win32 process %d: %s", pid, e)
        else:
            try:
                import signal
                os.kill(pid, signal.SIGSTOP)
                success = True
            except Exception as e:
                logger.error("Failed to suspend POSIX process %d: %s", pid, e)
                
        if success:
            task["status"] = "paused"
        return success

def resume_task(task_id: str) -> bool:
    with _lock:
        task = _tasks.get(task_id)
        if not task or task["status"] != "paused":
            return False
        
        process = task["process"]
        pid = process.pid
        logger.info("TaskManager: resuming task %s (PID %d)", task_id, pid)
        
        success = False
        if sys.platform == "win32":
            try:
                ntdll = ctypes.windll.ntdll
                kernel32 = ctypes.windll.kernel32
                PROCESS_SUSPEND_RESUME = 0x0800
                handle = kernel32.OpenProcess(PROCESS_SUSPEND_RESUME, False, pid)
                if handle:
                    ntdll.NtResumeProcess(handle)
                    kernel32.CloseHandle(handle)
                    success = True
            except Exception as e:
                logger.error("Failed to resume Win32 process %d: %s", pid, e)
        else:
            try:
                import signal
                os.kill(pid, signal.SIGCONT)
                success = True
            except Exception as e:
                logger.error("Failed to resume POSIX process %d: %s", pid, e)
                
        if success:
            task["status"] = "running"
        return success

def cancel_task(task_id: str) -> bool:
    with _lock:
        task = _tasks.get(task_id)
        if not task:
            return False
        
        task["status"] = "cancelled"
        process = task["process"]
        pid = process.pid
        logger.info("TaskManager: cancelling task %s (PID %d)", task_id, pid)
        
        try:
            process.kill()
        except Exception as e:
            logger.error("Failed to kill process %d: %s", pid, e)
        return True
