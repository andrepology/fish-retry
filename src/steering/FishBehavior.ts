import * as THREE from 'three'

export enum FishState {
  WANDER = "wander",
  APPROACH = "approach",
  EAT = "eat",
  REST = "rest",
}

export interface FishBehaviorOptions {
  approachThreshold?: number;    // distance under which the fish is considered to have reached the target
  restDuration?: number;           // how long the fish remains in REST state (in seconds)
  eatDuration?: number;            // how long the eating animation lasts (in seconds)
  bounds?: { min: number; max: number }; // allowed X and Z range for targets – these values can be computed responsively
  onEat?: () => void;              // callback triggered when the fish finishes eating (to animate and remove the food)
}

export class FishBehavior {
  public state: FishState;
  public target: THREE.Vector3 | null;
  public targetQueue: THREE.Vector3[];
  private options: FishBehaviorOptions;
  private timer: number; // used to time EAT and REST durations
  public restPosition: THREE.Vector3 | null; // Add this to store rest position
  public restDirection: THREE.Vector3 | null; // Add this to store rest direction

  constructor(options?: FishBehaviorOptions) {
    this.options = {
      approachThreshold: 0.5,
      restDuration: 2,   // seconds to rest after eating
      eatDuration: 1,    // seconds to simulate eating (during which an animation might run)
      bounds: { min: -10, max: 10 },
      onEat: undefined,
      ...options,
    }
    this.state = FishState.WANDER;
    this.target = null;
    this.targetQueue = [];
    this.restPosition = null;
    this.restDirection = null;
    this.timer = 0;
  }

  /**
   * External method to set the food target.
   * Instead of overriding the current target if one exists, we queue additional food points.
   */
  public setFoodTarget(target: THREE.Vector3) {
    if (!this.target) {
      this.target = target.clone();
      this.state = FishState.APPROACH;
      this.timer = 0;
    } else {
      // If already pursuing a target, add it to the queue.
      this.targetQueue.push(target.clone());
    }
  }

  /**
   * Call this on every frame.
   * The update logic is:
   * - In APPROACH, if the fish is near the target, switch to EAT.
   * - In EAT, count elapsed time (allowing an eating animation to play), then call onEat and switch to REST.
   * - In REST, wait a little (simulate a pause), then:
   *   > If there is another food target queued, switch to APPROACH with that target.
   *   > Otherwise, return to WANDER.
   */
  public update(headPosition: THREE.Vector3, velocity: THREE.Vector3, deltaTime: number) {
    switch (this.state) {
      case FishState.APPROACH: {
        if (this.target) {
          const distance = headPosition.distanceTo(this.target);
          if (distance < (this.options.approachThreshold || 0.5)) {
            this.state = FishState.EAT;
            this.timer = 0;
            console.log('Transitioning to EAT state');
          }
        }
        break;
      }
      case FishState.EAT: {
        this.timer += deltaTime;
        if (this.timer >= (this.options.eatDuration || 1)) {
          if (this.options.onEat) {
            this.options.onEat();
          }
          // Store current position and direction for REST state
          this.restPosition = headPosition.clone();
          this.restDirection = velocity.clone().normalize();
          if (this.restDirection.length() < 0.001) {
            this.restDirection.set(0, 0, 1);
          }
          this.state = FishState.REST;
          this.timer = 0;
          console.log('Transitioning to REST state');
        }
        break;
      }
      case FishState.REST: {
        this.timer += deltaTime;
        if (this.timer >= (this.options.restDuration || 2)) {
          // When finishing REST, check if another food target is waiting.
          if (this.targetQueue.length > 0) {
            this.target = this.targetQueue.shift()!;
            this.state = FishState.APPROACH;
            this.timer = 0;
            console.log('Switching to next food target from queue');
          } else {
            this.state = FishState.WANDER;
            this.target = null;
            this.restPosition = null;
            this.restDirection = null;
            this.timer = 0;
            console.log('Transitioning back to WANDER state');
          }
        }
        break;
      }
      case FishState.WANDER: {
        // Additionally, if in WANDER and a target has been queued, begin approaching it.
        if (!this.target && this.targetQueue.length > 0) {
          this.target = this.targetQueue.shift()!;
          this.state = FishState.APPROACH;
          this.timer = 0;
          console.log("Switching to next food target from queue (WANDER check)");
        }
        break;
      }
    }
  }

  public resetTarget() {
    this.target = null;
    this.targetQueue = [];
    this.restPosition = null;
    this.restDirection = null;
    this.state = FishState.WANDER;
    this.timer = 0;
  }
} 