import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-tag-input',
  templateUrl: './tag-input.component.html',
  styleUrls: ['./tag-input.component.scss']
})
export class TagInputComponent implements OnInit {

  @Input()
  tags = new Array<string>();
  @Output()
  tagsChange = new EventEmitter<Array<string>>();
  @Input("allow-space")
  allowSpace = true;
  @Input()
  type: string = "secondary";
  txtModel = "";
  private counter = -1;

  constructor() {
  }

  ngOnInit(): void {
  }

  remove(value: string, index: number) {
    const idx = this.tags.indexOf(value, 0);
    if (idx > -1) {
      this.tags.splice(index, 1);
    }
  }

  append(event: KeyboardEvent) {
    switch (event.code) {
      case "Enter":
        this.appendTag();
        break;
      case "Space":
        if (!this.allowSpace) {
          this.appendTag();
        }
        break;
      case "Backspace":
        console.log("back_value", event.code, this.txtModel, this.counter);
        if (this.txtModel === "" && this.counter === -1) {
          this.removeLast();
        } else {
          this.counter--;
        }
        break;
      default:
        this.counter++;
    }
  }

  click(event: MouseEvent | FocusEvent) {
    this.appendTag();
  }

  private appendTag() {
    if (this.txtModel && this.txtModel !== "") {
      this.tags.push(this.txtModel);
      this.txtModel = "";
      this.counter = -1;
    }
  }

  private removeLast() {
    if (this.tags.length === 0)
      return;
    this.counter = -1;
    let last = this.tags.length - 1;
    return this.remove(this.tags[last], last);
  }
}
